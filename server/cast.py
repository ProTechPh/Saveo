"""Build a local podcast RSS feed from downloaded audio history."""

import os
from datetime import datetime, timezone
from email.utils import format_datetime
from typing import Any, Dict, Iterable
from xml.sax.saxutils import escape

MIME_TYPES = {
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".aac": "audio/mp4",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".opus": "audio/ogg",
    ".flac": "audio/flac",
}


def media_type_for(path: str) -> str:
    return MIME_TYPES.get(os.path.splitext(path)[1].lower(), "application/octet-stream")


def build_feed(items: Iterable[Dict[str, Any]], base_url: str, token: str, limit: int = 100) -> str:
    """RSS 2.0 with iTunes tags; only audio items with a file on disk."""
    base = (base_url or "").rstrip("/")
    entries = []
    for item in items:
        if not item.get("is_audio") or not item.get("file_path"):
            continue
        if not os.path.isfile(item["file_path"]):
            continue
        entries.append(item)
        if len(entries) >= limit:
            break

    channel_items = []
    for item in entries:
        item_id = str(item.get("id") or "")
        media_url = f"{base}/api/cast/media/{token}/{item_id}"
        title = escape(str(item.get("title") or item.get("filename") or "Untitled audio"))
        description = escape(str(item.get("format_label") or "Downloaded audio"))
        size = int(item.get("file_size") or 0)
        try:
            published = format_datetime(datetime.fromtimestamp(float(item.get("created_at") or 0), timezone.utc))
        except Exception:
            published = format_datetime(datetime.now(timezone.utc))
        channel_items.append(
            "<item>"
            f"<title>{title}</title>"
            f"<description>{description}</description>"
            f"<guid isPermaLink=\"false\">{escape(item_id)}</guid>"
            f"<pubDate>{published}</pubDate>"
            f"<enclosure url=\"{escape(media_url, {'\"': '&quot;'})}\" length=\"{size}\" type=\"{media_type_for(item['file_path'])}\" />"
            "</item>"
        )

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">\n'
        "<channel>"
        "<title>Saveo Library</title>"
        f"<link>{escape(base)}</link>"
        "<description>Audio downloaded locally with Saveo.</description>"
        "<language>en</language>"
        "<itunes:author>Saveo</itunes:author>"
        + "".join(channel_items)
        + "</channel></rss>\n"
    )


def build_m3u(items: Iterable[Dict[str, Any]], base_url: str, token: str) -> str:
    base = (base_url or "").rstrip("/")
    lines = ["#EXTM3U"]
    for item in items:
        if not item.get("is_audio") or not item.get("file_path"):
            continue
        title = str(item.get("title") or item.get("filename") or "Audio").replace("\r", " ").replace("\n", " ")
        lines.append(f"#EXTINF:-1,{title}")
        lines.append(f"{base}/api/cast/media/{token}/{item.get('id', '')}")
    return "\n".join(lines) + "\n"
