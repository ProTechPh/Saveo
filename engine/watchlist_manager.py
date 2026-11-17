"""Local watchlist: check saved channels/playlists and enqueue only new items."""

import json
import os
import re
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from .settings_manager import settings_manager
from .file_manager import get_default_download_dir

QUALITY_LABELS = {
    "best": "Best Quality",
    "2160p": "2160p UHD",
    "1440p": "1440p QHD",
    "1080p": "1080p FHD",
    "720p": "720p HD",
    "480p": "480p SD",
    "audio_mp3": "Audio (MP3)",
    "audio_m4a": "Audio (M4A)",
}


class WatchlistManager:
    def __init__(self, state_file: Optional[str] = None):
        self.state_file = Path(state_file) if state_file else Path(settings_manager.config_dir) / "watchlist.json"
        self._lock = threading.RLock()
        self._check_lock = threading.Lock()
        self._items: List[Dict[str, Any]] = self._load()
        self._thread = None
        self._stop = threading.Event()

    def _load(self) -> List[Dict[str, Any]]:
        if not self.state_file.exists():
            return []
        try:
            with open(self.state_file, "r", encoding="utf-8") as handle:
                data = json.load(handle)
            return data if isinstance(data, list) else []
        except Exception as e:
            print(f"Error loading watchlist: {e}")
            return []

    def _save(self):
        try:
            with self._lock:
                items = list(self._items)
            self.state_file.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.state_file.with_suffix(".json.tmp")
            with open(tmp, "w", encoding="utf-8") as handle:
                json.dump(items, handle, indent=2)
            os.replace(tmp, self.state_file)
        except Exception as e:
            print(f"Error saving watchlist: {e}")

    def get_all(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [dict(item) for item in self._items]

    def get(self, item_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            for item in self._items:
                if item.get("id") == item_id:
                    return dict(item)
        return None

    def add(self, url: str, **options) -> Dict[str, Any]:
        quality = str(options.get("quality") or "best")
        if quality not in QUALITY_LABELS:
            quality = "best"
        is_audio = quality.startswith("audio_") or bool(options.get("is_audio"))
        audio_format = quality.replace("audio_", "") if quality.startswith("audio_") else (options.get("audio_format") or "mp3")
        format_id = "bestaudio" if is_audio else quality
        format_label = QUALITY_LABELS.get(quality, "Best Quality")
        folder = re.sub(r'[\\/*?:"<>|]', "", str(options.get("folder") or ""))[:120].strip()

        item = {
            "id": str(uuid.uuid4()),
            "url": url,
            "title": str(options.get("title") or "")[:300],
            "platform": str(options.get("platform") or "")[:100],
            "thumbnail": str(options.get("thumbnail") or "")[:2048],
            "quality": quality,
            "format_id": format_id,
            "format_label": format_label,
            "is_audio": is_audio,
            "audio_format": audio_format,
            "folder": folder,
            "max_items": max(1, min(50, int(options.get("max_items") or 10))),
            "min_duration": max(0, int(options.get("min_duration") or 0)),
            "max_duration": max(0, int(options.get("max_duration") or 0)),
            "include": str(options.get("include") or "")[:120].strip(),
            "exclude": str(options.get("exclude") or "")[:120].strip(),
            "enabled": True,
            "created_at": time.time(),
            "last_checked": 0,
            "last_added": 0,
            "last_skipped": 0,
            "last_error": "",
        }
        with self._lock:
            self._items.append(item)
            self._save()
        return dict(item)

    def remove(self, item_id: str) -> bool:
        with self._lock:
            before = len(self._items)
            self._items = [item for item in self._items if item.get("id") != item_id]
            changed = len(self._items) != before
            if changed:
                self._save()
            return changed

    def set_enabled(self, item_id: str, enabled: bool) -> bool:
        with self._lock:
            for item in self._items:
                if item.get("id") == item_id:
                    item["enabled"] = bool(enabled)
                    self._save()
                    return True
        return False

    def _filter_entries(self, entries: List[Dict[str, Any]], item: Dict[str, Any]) -> List[Dict[str, Any]]:
        include = (item.get("include") or "").lower()
        exclude = (item.get("exclude") or "").lower()
        min_duration = int(item.get("min_duration") or 0)
        max_duration = int(item.get("max_duration") or 0)
        limit = max(1, min(50, int(item.get("max_items") or 10)))

        selected = []
        for entry in entries:
            title = str(entry.get("title") or "")
            title_lower = title.lower()
            duration = int(entry.get("duration") or 0)
            if not entry.get("url"):
                continue
            if min_duration and duration and duration < min_duration:
                continue
            if max_duration and duration and duration > max_duration:
                continue
            if include and include not in title_lower:
                continue
            if exclude and exclude in title_lower:
                continue
            selected.append(entry)
            if len(selected) >= limit:
                break
        return selected

    def check_item(self, item: Dict[str, Any], queue_manager, registry_obj=None) -> Dict[str, Any]:
        from .providers.registry import registry as default_registry

        registry = registry_obj or default_registry
        provider = registry.get_provider_for_url(item["url"])
        meta = provider.get_metadata(item["url"])

        if getattr(meta, "is_playlist", False):
            entries = list(getattr(meta, "playlist_entries", []) or [])
        else:
            entries = [{
                "url": getattr(meta, "url", "") or item["url"],
                "title": getattr(meta, "title", ""),
                "thumbnail": getattr(meta, "thumbnail", ""),
                "duration": getattr(meta, "duration", 0),
            }]

        selected = self._filter_entries(entries, item)
        base_dir = settings_manager.get("download_dir", get_default_download_dir())
        output_dir = os.path.join(base_dir, item["folder"]) if item.get("folder") else base_dir
        os.makedirs(output_dir, exist_ok=True)

        added = 0
        skipped = 0
        try:
            for entry in selected:
                url = entry.get("url")
                duplicate = queue_manager.find_duplicate(url, item["format_label"], item["is_audio"])
                if duplicate:
                    skipped += 1
                    continue
                queue_manager.add_task(
                    url=url,
                    title=entry.get("title", ""),
                    thumbnail=entry.get("thumbnail", ""),
                    format_id=item["format_id"],
                    format_label=item["format_label"],
                    is_audio=item["is_audio"],
                    audio_format=item["audio_format"],
                    output_dir=output_dir,
                    persist=False,
                )
                added += 1
        finally:
            queue_manager.save_state()

        with self._lock:
            for stored in self._items:
                if stored.get("id") == item.get("id"):
                    stored["last_checked"] = time.time()
                    stored["last_added"] = added
                    stored["last_skipped"] = skipped
                    stored["last_error"] = ""
                    self._save()
                    break

        return {"checked": len(selected), "added": added, "skipped": skipped}

    def check_one(self, item_id: str, queue_manager, registry_obj=None) -> Optional[Dict[str, Any]]:
        item = self.get(item_id)
        if not item:
            return None
        return self.check_item(item, queue_manager, registry_obj)

    def check_all(self, queue_manager, registry_obj=None) -> List[Dict[str, Any]]:
        results = []
        for item in self.get_all():
            if not item.get("enabled", True):
                continue
            try:
                with self._check_lock:
                    result = self.check_item(item, queue_manager, registry_obj)
                result["id"] = item.get("id")
                results.append(result)
            except Exception as e:
                with self._lock:
                    for stored in self._items:
                        if stored.get("id") == item.get("id"):
                            stored["last_checked"] = time.time()
                            stored["last_error"] = str(e)[:300]
                            self._save()
                            break
        return results

    def start_scheduler(self, queue_manager):
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()

        def loop():
            # Give the app time to boot before the first network check.
            if self._stop.wait(30):
                return
            while not self._stop.is_set():
                try:
                    self.check_all(queue_manager)
                except Exception as e:
                    print(f"Watchlist check failed: {e}")
                try:
                    interval = max(15, min(1440, int(settings_manager.get("watch_interval_minutes", 60) or 60)))
                except (TypeError, ValueError):
                    interval = 60
                if self._stop.wait(interval * 60):
                    return

        self._thread = threading.Thread(target=loop, daemon=True, name="SaveoWatchlist")
        self._thread.start()

    def stop(self):
        self._stop.set()


watchlist_manager = WatchlistManager()
