"""Opt-in LAN page for queueing a link from a phone (Saveo Beam)."""

import html
import secrets
import socket
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

BEAM_PORT = 8767


def lan_ip() -> str:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("8.8.8.8", 80))
        address = sock.getsockname()[0]
        sock.close()
        return address
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"


def render_form(token: str, message: str = "", is_error: bool = False) -> str:
    safe_token = html.escape(token, quote=True)
    color = "#d95c58" if is_error else "#4fa96f"
    notice = f'<p style="color:{color};margin:0 0 14px;">{html.escape(message)}</p>' if message else ""
    return f"""<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0c0c0d"><title>Saveo Beam</title>
<style>
body{{margin:0;background:#0c0c0d;color:#ececee;font-family:system-ui,'Segoe UI',sans-serif;}}
main{{max-width:460px;margin:0 auto;padding:28px 18px;}}
h1{{font-size:20px;margin:0 0 6px}} p{{color:#9a9aa3;font-size:13px;line-height:1.5}}
label{{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#6c6c76;margin:16px 0 6px}}
input,select{{width:100%;box-sizing:border-box;height:42px;padding:0 10px;background:#0f0f11;color:#ececee;border:1px solid #26262a;border-radius:6px;font-size:14px}}
button{{width:100%;height:44px;margin-top:18px;background:#e5b04a;color:#1a1408;border:0;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer}}
small{{display:block;color:#6c6c76;font-size:11px;margin-top:18px;line-height:1.5}}
</style></head><body><main>
<h1>Saveo Beam</h1>
<p>Send a media link to Saveo on this computer.</p>
{notice}
<form method="post" action="/beam/{safe_token}">
  <label for="url">Media link</label>
  <input id="url" name="url" type="url" required placeholder="https://..." autocomplete="off">
  <label for="mode">Download as</label>
  <select id="mode" name="mode">
    <option value="video">Video — best quality</option>
    <option value="audio">Audio — MP3</option>
  </select>
  <button type="submit">Send to Saveo</button>
</form>
<small>Keep this page on your local network. Anyone with the link can queue downloads while Beam is enabled.</small>
</main></body></html>"""


class BeamServer:
    def __init__(self, port: int = BEAM_PORT):
        self.port = port
        self.token = ""
        self.server = None
        self.thread = None

    def _handler(self):
        beam = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def _send(self, body: str, status: int = 200):
                payload = body.encode("utf-8", errors="replace")
                self.send_response(status)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            def _token_ok(self, path: str) -> bool:
                parts = [part for part in path.strip("/").split("/") if part]
                return (
                    len(parts) == 2
                    and parts[0] == "beam"
                    and bool(beam.token)
                    and secrets.compare_digest(parts[1], beam.token)
                )

            def do_GET(self):
                parsed = urlparse(self.path)
                if not self._token_ok(parsed.path):
                    self._send(render_form("", "This Beam link is not valid.", True), 404)
                    return
                self._send(render_form(beam.token))

            def do_POST(self):
                parsed = urlparse(self.path)
                if not self._token_ok(parsed.path):
                    self._send(render_form("", "This Beam link is not valid.", True), 404)
                    return
                try:
                    length = int(self.headers.get("Content-Length") or 0)
                except ValueError:
                    length = 0
                if length <= 0 or length > 10_000:
                    self._send(render_form(beam.token, "Invalid request.", True), 400)
                    return

                form = parse_qs(self.rfile.read(length).decode("utf-8", errors="replace"))
                url = (form.get("url") or [""])[0].strip()
                mode = (form.get("mode") or ["video"])[0]

                from engine.providers.registry import registry
                from engine.queue_manager import queue_manager
                from engine.settings_manager import settings_manager
                from engine.file_manager import get_default_download_dir

                if not settings_manager.get("beam_enabled", False):
                    self._send(render_form(beam.token, "Saveo Beam is disabled.", True), 403)
                    return

                if not registry.is_valid_url(url):
                    self._send(render_form(beam.token, "Please provide a valid http(s) media link.", True), 400)
                    return

                is_audio = mode == "audio"
                label = "Audio (MP3)" if is_audio else "Best Quality"
                if settings_manager.get("skip_duplicates", True):
                    duplicate = queue_manager.find_duplicate(url, label, is_audio)
                    if duplicate:
                        self._send(render_form(beam.token, "That link is already downloaded or queued."))
                        return

                queue_manager.add_task(
                    url=url,
                    format_id="bestaudio" if is_audio else "best",
                    format_label=label,
                    is_audio=is_audio,
                    audio_format="mp3",
                    output_dir=settings_manager.get("download_dir", get_default_download_dir()),
                )
                self._send(render_form(beam.token, "Queued in Saveo. You can close this page."))

        return Handler

    def start(self) -> bool:
        if self.server:
            return True
        self.token = secrets.token_urlsafe(18)
        try:
            self.server = ThreadingHTTPServer(("0.0.0.0", self.port), self._handler())
            self.server.daemon_threads = True
        except Exception as e:
            print(f"Saveo Beam could not start: {e}")
            self.server = None
            self.token = ""
            return False
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True, name="SaveoBeam")
        self.thread.start()
        return True

    def stop(self):
        if self.server:
            try:
                self.server.shutdown()
                self.server.server_close()
            except Exception:
                pass
        self.server = None
        self.thread = None
        self.token = ""

    def apply(self, enabled: bool):
        if enabled:
            self.start()
        else:
            self.stop()

    def info(self) -> dict:
        if not self.server or not self.token:
            return {"enabled": False, "url": ""}
        return {
            "enabled": True,
            "url": f"http://{lan_ip()}:{self.port}/beam/{self.token}",
        }


beam_server = BeamServer()
