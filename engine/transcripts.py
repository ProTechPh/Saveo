"""Search downloaded subtitle sidecars and turn a match into a clip."""

import re
import threading
from pathlib import Path
from typing import Any, Dict, Iterable, List

_TIME = re.compile(
    r"(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{3})\s*-->\s*(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{3})"
)
_TAG = re.compile(r"<[^>]+>")
_CACHE: Dict[str, tuple] = {}
_CACHE_LOCK = threading.Lock()
SUBTITLE_EXTENSIONS = (".srt", ".vtt")


def _seconds(hours, minutes, seconds, millis) -> float:
    return int(hours or 0) * 3600 + int(minutes) * 60 + int(seconds) + int(millis) / 1000.0


def parse_subtitles(path: str) -> List[Dict[str, Any]]:
    """Parse basic SRT/VTT cues; returns [{start, end, text}]."""
    try:
        text = Path(path).read_text(encoding="utf-8", errors="replace")
    except Exception:
        return []

    cues = []
    for block in re.split(r"\r?\n\s*\r?\n", text):
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        for index, line in enumerate(lines):
            match = _TIME.search(line)
            if not match:
                continue
            start = _seconds(*match.group(1, 2, 3, 4))
            end = _seconds(*match.group(5, 6, 7, 8))
            content = " ".join(lines[index + 1:])
            content = _TAG.sub("", content).strip()
            if content:
                cues.append({"start": start, "end": end, "text": content})
            break
    return cues


def find_subtitle_files(media_path: str) -> List[str]:
    """Subtitle sidecars that share the media file's stem (Title.en.srt, Title.vtt...)."""
    if not media_path:
        return []
    media = Path(media_path)
    folder = media.parent
    stem = media.stem.lower()
    if not folder.is_dir():
        return []
    found = []
    try:
        for candidate in folder.iterdir():
            if (
                candidate.is_file()
                and candidate.suffix.lower() in SUBTITLE_EXTENSIONS
                and candidate.name.lower().startswith(stem)
            ):
                found.append(str(candidate))
    except Exception:
        return []
    return sorted(found)


def _cached_cues(path: str) -> List[Dict[str, Any]]:
    try:
        mtime = Path(path).stat().st_mtime
    except Exception:
        return []
    with _CACHE_LOCK:
        cached = _CACHE.get(path)
        if cached and cached[0] == mtime:
            return cached[1]
    cues = parse_subtitles(path)
    with _CACHE_LOCK:
        _CACHE[path] = (mtime, cues)
    return cues


def search_history(items: Iterable[Dict[str, Any]], query: str, limit: int = 50) -> List[Dict[str, Any]]:
    needle = (query or "").strip().lower()
    if len(needle) < 2:
        return []

    results = []
    for item in items:
        media_path = item.get("file_path") or ""
        if not media_path:
            continue
        for subtitle_path in find_subtitle_files(media_path):
            for cue in _cached_cues(subtitle_path):
                if needle not in cue["text"].lower():
                    continue
                results.append({
                    "id": item.get("id", ""),
                    "title": item.get("title", "Downloaded media"),
                    "file_path": media_path,
                    "subtitle_path": subtitle_path,
                    "text": cue["text"],
                    "start": cue["start"],
                    "end": cue["end"],
                    "start_time": max(0.0, cue["start"] - 3),
                    "end_time": cue["end"] + 3,
                    "url": item.get("url", ""),
                    "format_id": item.get("format_id", "best"),
                    "format_label": item.get("format_label", "Best Quality"),
                    "is_audio": bool(item.get("is_audio")),
                    "audio_format": item.get("audio_format", "mp3"),
                    "thumbnail": item.get("thumbnail", ""),
                })
                if len(results) >= limit:
                    return results
    return results
