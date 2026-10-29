import os
import shutil
import tempfile
import urllib.parse
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import yt_dlp

app = FastAPI(title="Saveo API", version="1.0.0")

# Enable CORS for Vercel and all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Length", "Content-Disposition", "Content-Type"],
)

LOCAL_COOKIE_FILE = os.path.join(os.path.dirname(__file__), "cookies.txt")
TEMP_COOKIE_FILE = os.path.join(tempfile.gettempdir(), "yt_cookies.txt")

def get_cookie_path() -> Optional[str]:
    raw_cookies = os.environ.get("YOUTUBE_COOKIES", "").strip()
    if raw_cookies:
        with open(TEMP_COOKIE_FILE, "w", encoding="utf-8") as f:
            f.write(raw_cookies)
        return TEMP_COOKIE_FILE
    if os.path.exists(LOCAL_COOKIE_FILE) and os.path.getsize(LOCAL_COOKIE_FILE) > 0:
        return LOCAL_COOKIE_FILE
    return None

def get_base_ydl_opts():
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "http_headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        }
    }
    cookie_path = get_cookie_path()
    if cookie_path:
        opts["cookiefile"] = cookie_path
    return opts

@app.get("/")
def root():
    has_cookies = get_cookie_path() is not None
    return {"status": "ok", "service": "Saveo Downloader API", "cookies_loaded": has_cookies}

@app.get("/health")
def health():
    return {"status": "ok"}

def sanitize_filename(name: str) -> str:
    invalid = '<>:"/\\|?*'
    for c in invalid:
        name = name.replace(c, "-")
    return name[:120].strip()

@app.get("/api/extract")
def extract_media(url: str = Query(..., description="Media URL to analyze")):
    try:
        ydl_opts = get_base_ydl_opts()
        ydl_opts.update({
            "skip_download": True,
            "extract_flat": False,
        })

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if not info:
                raise HTTPException(status_code=400, detail="Could not extract media info")

            title = info.get("title") or "Unknown title"
            uploader = info.get("uploader") or info.get("extractor") or "Web"
            thumbnail = info.get("thumbnail") or None
            duration = info.get("duration") or None
            extractor = info.get("extractor_key") or "Media"

            formats_list = []
            raw_formats = info.get("formats", [])

            # Audio format
            formats_list.append({
                "id": "bestaudio",
                "label": "Audio (MP3)",
                "note": "192kbps MP3",
                "kind": "audio",
                "url": f"/api/download?url={urllib.parse.quote(url)}&format_id=bestaudio",
                "filename": f"{sanitize_filename(title)}.mp3",
                "size": None,
                "mime": "audio/mp3",
            })

            # Video formats
            heights_seen = set()
            for f in sorted(raw_formats, key=lambda x: (x.get("height") or 0, x.get("tbr") or 0), reverse=True):
                h = f.get("height")
                vcodec = f.get("vcodec", "none")
                if not h or vcodec == "none" or h in heights_seen:
                    continue
                if h not in [1080, 720, 480, 360]:
                    continue
                heights_seen.add(h)

                filesize = f.get("filesize") or f.get("filesize_approx")
                formats_list.append({
                    "id": f"video_{h}",
                    "label": f"{h}p MP4",
                    "note": f"Video ({h}p)",
                    "kind": "video",
                    "url": f"/api/download?url={urllib.parse.quote(url)}&format_id=video_{h}",
                    "filename": f"{sanitize_filename(title)}-{h}p.mp4",
                    "size": filesize,
                    "mime": "video/mp4",
                })

            if not any(f["kind"] == "video" for f in formats_list):
                formats_list.append({
                    "id": "best",
                    "label": "Best Quality MP4",
                    "note": "Standard video",
                    "kind": "video",
                    "url": f"/api/download?url={urllib.parse.quote(url)}&format_id=best",
                    "filename": f"{sanitize_filename(title)}.mp4",
                    "size": None,
                    "mime": "video/mp4",
                })

            return {
                "media": {
                    "title": title,
                    "uploader": uploader,
                    "thumbnail": thumbnail,
                    "duration": duration,
                    "platform": extractor,
                    "webpageUrl": url,
                },
                "formats": formats_list,
                "notice": None,
            }

    except Exception as e:
        err_msg = str(e)
        raise HTTPException(status_code=400, detail=err_msg)

@app.get("/api/download")
def download_media(
    url: str = Query(...),
    format_id: str = Query("best")
):
    tmpdir = tempfile.mkdtemp(prefix="saveo_")
    try:
        out_template = os.path.join(tmpdir, "%(title)s.%(ext)s")
        ydl_opts = get_base_ydl_opts()
        ydl_opts.update({
            "outtmpl": out_template,
        })

        if format_id == "bestaudio":
            ydl_opts["format"] = "bestaudio/best"
            ydl_opts["postprocessors"] = [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }]
        elif format_id.startswith("video_"):
            height = format_id.split("_")[1]
            ydl_opts["format"] = f"bestvideo[height<={height}]+bestaudio/best[height<={height}]/best"
            ydl_opts["merge_output_format"] = "mp4"
        else:
            ydl_opts["format"] = "bestvideo+bestaudio/best"
            ydl_opts["merge_output_format"] = "mp4"

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = sanitize_filename(info.get("title") or "download")

        downloaded_files = os.listdir(tmpdir)
        if not downloaded_files:
            raise HTTPException(status_code=500, detail="File download failed on server")

        file_path = os.path.join(tmpdir, downloaded_files[0])
        ext = os.path.splitext(file_path)[1].lstrip(".")
        filename = f"{title}.{ext}"
        media_type = "audio/mpeg" if ext == "mp3" else "video/mp4"

        def iterfile():
            try:
                with open(file_path, mode="rb") as f:
                    while chunk := f.read(1024 * 1024):
                        yield chunk
            finally:
                shutil.rmtree(tmpdir, ignore_errors=True)

        encoded_filename = urllib.parse.quote(filename)
        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"; filename*=UTF-8\'\'{encoded_filename}',
            "Content-Length": str(os.path.getsize(file_path)),
            "Access-Control-Allow-Origin": "*",
        }

        return StreamingResponse(iterfile(), media_type=media_type, headers=headers)

    except Exception as e:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(e))
