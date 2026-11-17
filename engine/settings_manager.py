"""
Saveo - Settings Manager
Persists and manages user configurations in local config storage.
"""

import json
import os
import re
import shutil
import threading
from pathlib import Path
from typing import Dict, Any
from .file_manager import get_default_download_dir


class SettingsManager:
    def __init__(self, config_dir: Path = None):
        if config_dir is None:
            self.config_dir = Path.home() / ".saveo"
        else:
            self.config_dir = config_dir

        try:
            self.config_dir.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass
        self.config_file = self.config_dir / "settings.json"
        self._lock = threading.RLock()
        self._settings = self._load()

    def get_defaults(self) -> Dict[str, Any]:
        return {
            "download_dir": get_default_download_dir(),
            "default_video_quality": "1080p",
            "default_audio_format": "mp3",
            "max_concurrent_downloads": 3,
            "fragment_concurrency": 1,
            "rate_limit_kbps": 0,
            "theme": "dark",
            "filename_template": "{title}",
            "notifications": True,
            "skip_duplicates": True,
            "subtitles_enabled": False,
            "subtitle_langs": "en",
            "subtitle_mode": "sidecar",
            "embed_metadata": False,
            "embed_thumbnail": False,
            "schedule_enabled": False,
            "schedule_start": "01:00",
            "schedule_stop": "07:00",
            "cast_token": "",
            "beam_enabled": False,
            "cookie_file": "",
            "cookie_browser": "none",
        }

    def _load(self) -> Dict[str, Any]:
        defaults = self.get_defaults()
        if not self.config_file.exists():
            self._save(defaults)
            return defaults
        try:
            with open(self.config_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                # merge with defaults for any new keys
                for k, v in defaults.items():
                    if k not in data:
                        data[k] = v
                return data
        except Exception as e:
            print(f"Error loading settings, resetting to defaults: {e}")
            return defaults

    def _save(self, data: Dict[str, Any]):
        try:
            tmp_file = self.config_file.with_suffix(".json.tmp")
            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            os.replace(tmp_file, self.config_file)
        except Exception as e:
            print(f"Error saving settings: {e}")

    def get_all(self) -> Dict[str, Any]:
        with self._lock:
            return self._settings.copy()

    def get(self, key: str, default=None):
        with self._lock:
            return self._settings.get(key, default)

    def update(self, updates: Dict[str, Any]) -> Dict[str, Any]:
        updates = dict(updates or {})
        if "max_concurrent_downloads" in updates:
            try:
                updates["max_concurrent_downloads"] = max(1, min(5, int(updates["max_concurrent_downloads"])))
            except (TypeError, ValueError):
                updates.pop("max_concurrent_downloads", None)
        if "fragment_concurrency" in updates:
            try:
                updates["fragment_concurrency"] = max(1, min(8, int(updates["fragment_concurrency"])))
            except (TypeError, ValueError):
                updates.pop("fragment_concurrency", None)
        if "rate_limit_kbps" in updates:
            try:
                updates["rate_limit_kbps"] = max(0, min(1_000_000, int(updates["rate_limit_kbps"])))
            except (TypeError, ValueError):
                updates.pop("rate_limit_kbps", None)
        if "subtitle_mode" in updates and updates.get("subtitle_mode") not in ("sidecar", "embed"):
            updates["subtitle_mode"] = "sidecar"
        if "subtitle_langs" in updates:
            langs = re.sub(r"[^A-Za-z0-9,._\- ]", "", str(updates.get("subtitle_langs") or ""))[:200].strip()
            updates["subtitle_langs"] = langs or "en"
        for flag in ("subtitles_enabled", "embed_metadata", "embed_thumbnail"):
            if flag in updates:
                updates[flag] = bool(updates[flag])
        if "schedule_enabled" in updates:
            updates["schedule_enabled"] = bool(updates["schedule_enabled"])
        if "beam_enabled" in updates:
            updates["beam_enabled"] = bool(updates["beam_enabled"])
        for key, fallback in (("schedule_start", "01:00"), ("schedule_stop", "07:00")):
            if key in updates:
                value = str(updates.get(key) or "").strip()
                updates[key] = value if re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", value) else fallback
        with self._lock:
            self._settings.update(updates)
            self._save(self._settings)
            return self._settings.copy()


settings_manager = SettingsManager()
