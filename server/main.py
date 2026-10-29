import os
import shutil
import subprocess
import tempfile
import urllib.parse
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import yt_dlp
import yt_dlp.version

app = FastAPI(title="Saveo API", version="1.0.0")

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
        "js_runtimes": ["node"],
        "remote_components": ["ejs:github"],
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

@app.get("/api/version")
def version_info():
    try:
        node_v = subprocess.check_output(["node", "-v"], stderr=subprocess.STDOUT).decode().strip()
    except Exception as e:
        node_v = str(e)
    return {
        "yt_dlp_version": yt_dlp.version.__version__,
        "node_version": node_v,
    }

@app.get("/api/debug_raw")
def debug_raw(url: str = Query(...)):
    try:
        opts = get_base_ydl_opts()
        opts.update({
            "skip_download": True,
            "extract_flat": False,
            "format": "all",
            "ignore_no_formats_error": True,
        })
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return {
                "all_format_ids": [f.get("format_id") for f in info.get("formats", [])],
                "all_exts": list(set(f.get("ext") for f in info.get("formats", []))),
            }
    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}

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
            "format": "all",
            "ignore_no_formats_error": True,
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

            # 1080p, 720p, 480p, 360p
            video_resolutions = [
                (1080, "1080p Full HD", "Full HD video"),
                (720, "720p HD", "High Definition video"),
                (480, "480p SD", "Standard video"),
                (360, "360p Medium", "Data-saver video"),
            ]

            for res_h, res_label, res_note in video_resolutions:
                formats_list.append({
                    "id": f"video_{res_h}",
                    "label": res_label,
                    "note": res_note,
                    "kind": "video",
                    "url": f"/api/download?url={urllib.parse.quote(url)}&format_id=video_{res_h}",
                    "filename": f"{sanitize_filename(title)}-{res_h}p.mp4",
                    "size": None,
                    "mime": "video/mp4",
                })

            # Audio MP3
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
            ydl_opts["format"] = "ba/b"
            ydl_opts["postprocessors"] = [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }]
        elif format_id.startswith("video_"):
            height = format_id.split("_")[1]
            ydl_opts["format"] = f"bv*[height<={height}]+ba/b[height<={height}]/b"
            ydl_opts["merge_output_format"] = "mp4"
        else:
            ydl_opts["format"] = "bv*+ba/b"
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
