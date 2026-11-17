"""
Saveo - Direct Media Provider
Handles direct HTTP/HTTPS media URLs (mp4, webm, mp3, m4a, wav, mkv, flac, etc.)
"""

import os
import re
import time
import requests
from urllib.parse import urlparse, unquote
from typing import List, Dict, Any, Callable, Optional
from .base import BaseProvider, MediaMetadata, MediaFormat, ProviderCapabilities
from ..file_manager import apply_filename_template, get_unique_filename, format_bytes


DIRECT_MEDIA_EXTENSIONS = {
    ".mp4", ".webm", ".mkv", ".mov", ".avi", ".flv",
    ".mp3", ".m4a", ".wav", ".aac", ".flac", ".ogg", ".opus"
}

AUDIO_EXTENSIONS = {".mp3", ".m4a", ".wav", ".aac", ".flac", ".ogg", ".opus"}


DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Encoding": "identity",
}

class DirectProvider(BaseProvider):
    def can_handle(self, url: str) -> bool:
        try:
            parsed = urlparse(url)
            path = parsed.path.lower()
            return any(path.endswith(ext) for ext in DIRECT_MEDIA_EXTENSIONS)
        except Exception:
            return False

    def detect_platform(self, url: str) -> str:
        parsed = urlparse(url)
        path = parsed.path.lower()
        ext = os.path.splitext(path)[1].upper().replace('.', '')
        return f"Direct {ext} Stream"

    def get_metadata(self, url: str) -> MediaMetadata:
        parsed = urlparse(url)
        raw_name = os.path.basename(parsed.path)
        name = unquote(raw_name)
        title = os.path.splitext(name)[0] or "Direct Stream"
        ext = os.path.splitext(name)[1].lower().replace('.', '') or "mp4"

        # Probe HEAD request to get file size
        filesize = 0
        try:
            resp = requests.head(url, headers=DEFAULT_HEADERS, allow_redirects=True, timeout=5)
            if resp.status_code == 200:
                filesize = int(resp.headers.get("content-length", 0))
        except Exception:
            pass

        is_audio = f".{ext}" in AUDIO_EXTENSIONS
        format_entry = MediaFormat(
            format_id="direct_original",
            ext=ext,
            resolution="audio-only" if is_audio else "Source Resolution",
            label=f"Direct Stream ({ext.upper()})",
            filesize_approx=filesize,
            filesize_str=format_bytes(filesize) if filesize > 0 else "Direct",
            has_video=not is_audio,
            has_audio=True,
            is_audio_only=is_audio
        )

        return MediaMetadata(
            id=f"direct_{hash(url)}",
            url=url,
            title=title,
            platform=self.detect_platform(url),
            uploader=parsed.netloc or "Direct Link",
            uploader_url=f"{parsed.scheme}://{parsed.netloc}",
            duration=0,
            duration_str="Direct File",
            thumbnail="", # no thumbnail for raw files
            description=f"Direct downloadable media link from {parsed.netloc}",
            formats=[format_entry] if not is_audio else [],
            audio_formats=[format_entry] if is_audio else [],
            webpage_url=url,
            original_url=url
        )

    def get_formats(self, url: str) -> List[MediaFormat]:
        meta = self.get_metadata(url)
        return meta.formats or meta.audio_formats

    def download(
        self,
        url: str,
        format_id: str,
        output_dir: str,
        filename_template: str,
        is_audio: bool,
        audio_format: str,
        on_progress: Callable[[Dict[str, Any]], None],
        cancel_check: Callable[[], bool],
        title: str = "",
        start_time: Optional[float] = None,
        end_time: Optional[float] = None
    ) -> Dict[str, Any]:
        if start_time is not None or end_time is not None:
            raise Exception("Chapter clips require the yt-dlp engine and FFmpeg.")
        parsed = urlparse(url)
        raw_name = os.path.basename(parsed.path)
        name = unquote(raw_name)
        stem = os.path.splitext(name)[0] or "media"
        ext = os.path.splitext(name)[1] or (".mp3" if is_audio else ".mp4")

        safe_title = apply_filename_template(filename_template, title or stem)
        target_filename = get_unique_filename(output_dir, f"{safe_title}{ext}")
        final_path = os.path.join(output_dir, target_filename)
        part_path = f"{final_path}.part"

        # Resume a paused/partial direct download with an HTTP Range request.
        resume_offset = 0
        try:
            if os.path.exists(part_path):
                resume_offset = os.path.getsize(part_path)
        except Exception:
            resume_offset = 0

        headers = dict(DEFAULT_HEADERS)
        if resume_offset > 0:
            headers["Range"] = f"bytes={resume_offset}-"

        start_time = time.time()
        last_update_time = 0.0
        downloaded_bytes = resume_offset
        total_bytes = resume_offset
        session_start_bytes = resume_offset
        cancelled = False

        with requests.get(url, headers=headers, stream=True, timeout=15) as r:
            r.raise_for_status()
            if resume_offset > 0 and r.status_code != 206:
                # Server ignored Range: start the file over instead of appending.
                resume_offset = 0
                downloaded_bytes = 0
                session_start_bytes = 0
            content_length = int(r.headers.get('content-length', 0))
            total_bytes = resume_offset + content_length
            mode = 'ab' if resume_offset > 0 else 'wb'

            with open(part_path, mode) as f:
                for chunk in r.iter_content(chunk_size=65536):
                    if cancel_check():
                        cancelled = True
                        break

                    if chunk:
                        f.write(chunk)
                        downloaded_bytes += len(chunk)

                        now = time.time()
                        if now - last_update_time >= 0.25:
                            last_update_time = now
                            elapsed = max(now - start_time, 0.001)
                            speed = max(downloaded_bytes - session_start_bytes, 0) / elapsed
                            speed_str = f"{format_bytes(int(speed))}/s"

                            eta_str = "--:--"
                            percent = 0.0
                            if total_bytes > 0 and downloaded_bytes <= total_bytes:
                                percent = round((downloaded_bytes / total_bytes) * 100, 1)
                                remaining = max(total_bytes - downloaded_bytes, 0)
                                if speed > 0:
                                    eta_sec = int(remaining / speed)
                                    m, s = divmod(eta_sec, 60)
                                    eta_str = f"{m:02d}:{s:02d}"

                            on_progress({
                                "status": "downloading",
                                "percent": percent,
                                "downloaded_bytes": downloaded_bytes,
                                "total_bytes": total_bytes,
                                "speed_str": speed_str,
                                "eta_str": eta_str
                            })

        if cancelled:
            try:
                os.remove(part_path)
            except Exception:
                pass
            raise Exception("Download cancelled by user.")

        try:
            os.replace(part_path, final_path)
        except Exception:
            # Some filesystems dislike replacing while another task holds the part;
            # fall back to a copy so the completed file still lands.
            import shutil
            shutil.copyfile(part_path, final_path)
            try:
                os.remove(part_path)
            except Exception:
                pass

        # Final progress
        on_progress({
            "status": "finished",
            "percent": 100.0,
            "downloaded_bytes": downloaded_bytes,
            "total_bytes": downloaded_bytes,
            "speed_str": "Completed",
            "eta_str": "00:00"
        })

        return {
            "file_path": final_path,
            "filename": target_filename,
            "file_size": downloaded_bytes,
            "file_size_str": format_bytes(downloaded_bytes)
        }

    def capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(
            name="Direct Stream Provider",
            can_extract_metadata=True,
            can_stream_download=True,
            supports_quality_selection=False,
            supports_audio_extraction=False
        )
