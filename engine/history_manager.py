"""
Saveo - History Manager
Maintains records of completed, failed, and past downloads locally.
"""

import json
import os
import shutil
import threading
import time
from pathlib import Path
from typing import List, Dict, Any, Optional
from .provenance import sidecar_path


class HistoryManager:
    def __init__(self, config_dir: Path = None):
        if config_dir is None:
            self.config_dir = Path.home() / ".saveo"
        else:
            self.config_dir = config_dir

        try:
            self.config_dir.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass
        self.history_file = self.config_dir / "history.json"
        self._lock = threading.RLock()
        self._history: List[Dict[str, Any]] = self._load()

    def _load(self) -> List[Dict[str, Any]]:
        if not self.history_file.exists():
            return []
        try:
            with open(self.history_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading download history: {e}")
            return []

    def _save(self):
        try:
            tmp_file = self.history_file.with_suffix(".json.tmp")
            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(self._history, f, indent=2)
            os.replace(tmp_file, self.history_file)
        except Exception as e:
            print(f"Error saving download history: {e}")

    def get_all(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(reversed(self._history))

    def find_duplicate(self, url: str, format_label: str, is_audio: bool) -> Optional[Dict[str, Any]]:
        """Return a completed record for the same URL + format, if one exists."""
        if not url:
            return None
        with self._lock:
            for item in reversed(self._history):
                if (
                    item.get("url") == url
                    and item.get("status", "completed") == "completed"
                    and item.get("format_label", "") == (format_label or "")
                    and bool(item.get("is_audio")) == bool(is_audio)
                ):
                    return dict(item)
        return None

    def add_entry(self, entry: Dict[str, Any]) -> Dict[str, Any]:
        """
        Add or update history record.
        """
        record = {
            "id": entry.get("id", str(int(time.time() * 1000))),
            "title": entry.get("title", "Untitled Media"),
            "url": entry.get("url", ""),
            "platform": entry.get("platform", "Unknown"),
            "filename": entry.get("filename", ""),
            "file_path": entry.get("file_path", ""),
            "file_size": entry.get("file_size", 0),
            "file_size_str": entry.get("file_size_str", ""),
            "format_label": entry.get("format_label", ""),
            "format_id": entry.get("format_id", ""),
            "audio_format": entry.get("audio_format", ""),
            "start_time": entry.get("start_time"),
            "end_time": entry.get("end_time"),
            "is_audio": entry.get("is_audio", False),
            "thumbnail": entry.get("thumbnail", ""),
            "status": entry.get("status", "completed"), # completed, failed
            "error": entry.get("error", None),
            "sha256": entry.get("sha256", ""),
            "provenance_path": entry.get("provenance_path", ""),
            "created_at": entry.get("created_at", int(time.time())),
            "created_at_str": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(entry.get("created_at", time.time()))),
        }

        with self._lock:
            # Check if record with this id already exists, update it
            existing_idx = next((i for i, item in enumerate(self._history) if item.get("id") == record["id"]), None)
            if existing_idx is not None:
                self._history[existing_idx] = record
            else:
                self._history.append(record)

            self._save()
        return record

    def remove_entry(self, entry_id: str, delete_file: bool = False) -> bool:
        """
        Remove record from history. If delete_file is True, also deletes the actual local file.
        """
        with self._lock:
            idx = next((i for i, item in enumerate(self._history) if item.get("id") == entry_id), None)
            if idx is not None:
                item = self._history.pop(idx)
                if delete_file:
                    fp = item.get("file_path")
                    if fp and os.path.exists(fp):
                        try:
                            os.remove(fp)
                        except Exception as e:
                            print(f"Error removing file {fp}: {e}")
                    receipt = sidecar_path(fp) if fp else ""
                    if receipt and os.path.exists(receipt):
                        try:
                            os.remove(receipt)
                        except Exception:
                            pass
                self._save()
                return True
        return False

    def update_fields(self, entry_id: str, fields: Dict[str, Any]) -> bool:
        with self._lock:
            for item in self._history:
                if item.get("id") == entry_id:
                    item.update(fields)
                    self._save()
                    return True
        return False

    def clear_all(self):
        with self._lock:
            self._history = []
            self._save()


history_manager = HistoryManager()
