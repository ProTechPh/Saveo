"""Saveo - direct provider download, resume, pause and cancel behavior."""

import os
import shutil
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from engine.providers.direct_provider import DirectProvider


PAYLOAD = (b"Saveo direct-provider test payload. " * 12000)[:300_000]


class RangeHandler(BaseHTTPRequestHandler):
    requests_seen = []

    def do_GET(self):
        requested_range = self.headers.get("Range")
        RangeHandler.requests_seen.append(requested_range)

        if requested_range and requested_range.startswith("bytes="):
            start = int(requested_range.split("=", 1)[1].split("-", 1)[0])
            body = PAYLOAD[start:]
            self.send_response(206)
            self.send_header("Content-Range", f"bytes {start}-{len(PAYLOAD) - 1}/{len(PAYLOAD)}")
        else:
            body = PAYLOAD
            self.send_response(200)

        self.send_header("Content-Length", str(len(body)))
        self.send_header("Content-Type", "video/mp4")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


class TestDirectProvider(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), RangeHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f"http://127.0.0.1:{cls.server.server_address[1]}/clip.mp4"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _download(self, title, cancel_check=None):
        provider = DirectProvider()
        return provider.download(
            url=self.url,
            format_id="direct_original",
            output_dir=self.temp_dir,
            filename_template="{title}",
            is_audio=False,
            audio_format="mp3",
            on_progress=lambda info: None,
            cancel_check=cancel_check or (lambda: False),
            title=title,
        )

    def test_full_download_uses_template_and_removes_part(self):
        result = self._download("My: Clip")
        self.assertEqual(result["filename"], "My Clip.mp4")
        self.assertEqual(Path(result["file_path"]).read_bytes(), PAYLOAD)
        self.assertFalse(os.path.exists(f"{result['file_path']}.part"))

    def test_resume_sends_range_and_completes(self):
        part_path = Path(self.temp_dir) / "Resume Test.mp4.part"
        part_path.write_bytes(PAYLOAD[:50_000])
        RangeHandler.requests_seen.clear()

        result = self._download("Resume Test")

        self.assertEqual(Path(result["file_path"]).read_bytes(), PAYLOAD)
        self.assertIn("bytes=50000-", RangeHandler.requests_seen)
        self.assertFalse(os.path.exists(str(part_path)))

    def test_pause_keeps_part_for_resume(self):
        class Paused(Exception):
            pass

        calls = {"count": 0}

        def stop():
            calls["count"] += 1
            if calls["count"] >= 2:
                raise Paused("Download paused by user.")
            return False

        with self.assertRaises(Paused):
            self._download("Paused Clip", stop)

        part_path = Path(self.temp_dir) / "Paused Clip.mp4.part"
        self.assertTrue(part_path.exists(), "pause must keep the .part file")
        self.assertGreater(part_path.stat().st_size, 0)

    def test_cancel_removes_part(self):
        calls = {"count": 0}

        def stop():
            calls["count"] += 1
            return calls["count"] >= 2

        with self.assertRaises(Exception):
            self._download("Cancelled Clip", stop)

        part_path = Path(self.temp_dir) / "Cancelled Clip.mp4.part"
        self.assertFalse(part_path.exists(), "cancel must remove its .part file")
        self.assertFalse((Path(self.temp_dir) / "Cancelled Clip.mp4").exists())


if __name__ == "__main__":
    unittest.main()
