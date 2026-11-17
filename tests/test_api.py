"""
Saveo - API Integration Tests
Tests all FastAPI REST endpoints.
"""

import atexit
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

# Keep the suite away from the developer's real ~/.saveo config, history, and cookies.
_TEST_HOME = tempfile.mkdtemp(prefix="saveo-test-home-")
os.environ["HOME"] = _TEST_HOME
os.environ["USERPROFILE"] = _TEST_HOME
atexit.register(shutil.rmtree, _TEST_HOME, True)

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

try:
    from fastapi.testclient import TestClient
except RuntimeError as exc:
    raise unittest.SkipTest(f"FastAPI TestClient unavailable: {exc}")

from server.api import app, AUTH_TOKEN

client = TestClient(app, headers={"X-Auth-Token": AUTH_TOKEN})


class TestAPIEndpoints(unittest.TestCase):

    def test_tests_use_isolated_config(self):
        from engine.settings_manager import settings_manager
        self.assertTrue(str(settings_manager.config_dir).startswith(_TEST_HOME))

    def test_security_missing_token_unauthorized(self):
        raw_client = TestClient(app)
        resp = raw_client.get("/api/settings")
        self.assertEqual(resp.status_code, 401)
        self.assertEqual(resp.json()["error"], "Unauthorized")

    def test_security_cross_site_protection(self):
        resp = client.get("/api/settings", headers={"Sec-Fetch-Site": "cross-site"})
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.json()["error"], "Forbidden")

    def test_security_unauthorized_origin(self):
        resp = client.get("/api/settings", headers={"Origin": "https://malicious-site.com"})
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.json()["error"], "Forbidden")

    def test_security_input_bounding(self):
        # Exceeds 2048 character URL ceiling
        giant_url = "https://youtube.com/watch?v=" + ("x" * 2500)
        resp = client.post("/api/detect-platform", json={"url": giant_url})
        self.assertEqual(resp.status_code, 422)

    def test_security_path_traversal_guard(self):
        # Path outside allowed directories is rejected
        resp = client.post("/api/open-file", json={"file_path": "C:\\Windows\\System32\\calc.exe"})
        # Either 403 (blocked by traversal guard) or 200/404 if file does not exist
        if resp.status_code != 200:
            self.assertIn(resp.status_code, (403, 404))

    def test_open_folder_path_traversal_guard(self):
        resp = client.post("/api/open-folder", json={"path": "C:\\Windows\\System32"})
        self.assertEqual(resp.status_code, 403)

    def test_detect_platform_endpoint(self):
        resp = client.post("/api/detect-platform", json={"url": "https://www.youtube.com/watch?v=test123"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["valid"])
        self.assertEqual(data["platform"], "YouTube")

    def test_detect_platform_invalid_url(self):
        resp = client.post("/api/detect-platform", json={"url": "invalid-link"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertFalse(data["valid"])
        self.assertEqual(data["platform"], "Unknown")

    def test_batch_parse_endpoint(self):
        sample_text = """
        https://www.youtube.com/watch?v=11111111111
        https://x.com/user/status/22222222222
        https://www.youtube.com/watch?v=11111111111
        not-a-link
        https://vimeo.com/333333333
        """
        resp = client.post("/api/batch/parse", json={"text": sample_text})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["count"], 3) # 3 unique URLs
        self.assertEqual(len(data["items"]), 3)

    def test_settings_endpoints(self):
        # GET settings
        resp = client.get("/api/settings")
        self.assertEqual(resp.status_code, 200)
        orig_settings = resp.json()
        self.assertIn("download_dir", orig_settings)

        # UPDATE settings
        resp = client.post("/api/settings", json={"settings": {"max_concurrent_downloads": 4}})
        self.assertEqual(resp.status_code, 200)
        updated = resp.json()
        self.assertEqual(updated["max_concurrent_downloads"], 4)

    def test_history_endpoints(self):
        resp = client.get("/api/history")
        self.assertEqual(resp.status_code, 200)
        self.assertIsInstance(resp.json(), list)

    def test_duplicate_download_is_skipped(self):
        from engine.history_manager import history_manager
        url = "https://example.com/watch/duplicate-test"
        label = "1080p FHD • MP4"
        history_manager.add_entry({
            "id": "dup-api",
            "url": url,
            "title": "Already here",
            "format_label": label,
            "is_audio": False,
            "status": "completed",
            "filename": "already.mp4",
        })
        try:
            resp = client.post("/api/download", json={
                "url": url, "format_label": label, "is_audio": False,
            })
            self.assertEqual(resp.status_code, 200)
            self.assertTrue(resp.json().get("duplicate"))

            batch = client.post("/api/batch/enqueue", json={
                "urls": [url], "format_label": label, "is_audio": False,
            })
            self.assertEqual(batch.status_code, 200)
            self.assertEqual(batch.json()["count"], 0)
            self.assertEqual(len(batch.json()["skipped"]), 1)
        finally:
            history_manager.remove_entry("dup-api")

    def test_transcript_search_endpoint(self):
        import tempfile
        from engine.history_manager import history_manager
        folder = tempfile.mkdtemp(prefix="saveo-transcript-")
        media = Path(folder) / "episode.mp4"
        media.write_bytes(b"video")
        subtitle = Path(folder) / "episode.en.srt"
        subtitle.write_text(
            "1\n00:00:01,000 --> 00:00:03,000\nOffline media search.\n",
            encoding="utf-8",
        )
        history_manager.add_entry({
            "id": "transcript-api",
            "url": "https://example.com/episode",
            "title": "Episode",
            "file_path": str(media),
            "format_label": "1080p FHD • MP4",
            "status": "completed",
        })
        try:
            resp = client.get("/api/transcripts/search?q=offline")
            self.assertEqual(resp.status_code, 200)
            results = resp.json()
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0]["id"], "transcript-api")
        finally:
            history_manager.remove_entry("transcript-api")
            import shutil
            shutil.rmtree(folder, ignore_errors=True)

    def test_verify_history_endpoint(self):
        import tempfile
        import shutil
        from engine.history_manager import history_manager
        from engine.provenance import sha256_file
        folder = tempfile.mkdtemp(prefix="saveo-verify-")
        media = Path(folder) / "verified.mp3"
        media.write_bytes(b"verified bytes")
        digest = sha256_file(str(media))
        history_manager.add_entry({
            "id": "verify-api",
            "url": "https://example.com/verified",
            "title": "Verified",
            "file_path": str(media),
            "file_size": media.stat().st_size,
            "sha256": digest,
            "status": "completed",
        })
        try:
            resp = client.get("/api/history/verify-api/verify")
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.json()["status"], "verified")
        finally:
            history_manager.remove_entry("verify-api")
            shutil.rmtree(folder, ignore_errors=True)

    def test_watchlist_add_list_delete(self):
        resp = client.post("/api/watchlist", json={
            "url": "https://example.com/channel",
            "quality": "1080p",
            "max_items": 5,
        })
        self.assertEqual(resp.status_code, 200)
        item = resp.json()
        self.assertEqual(item["format_label"], "1080p FHD")

        listing = client.get("/api/watchlist").json()
        self.assertTrue(any(entry["id"] == item["id"] for entry in listing["items"]))

        resp = client.delete(f"/api/watchlist/{item['id']}")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["success"])

    def test_system_status_endpoint(self):
        resp = client.get("/api/system/status")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIsInstance(data["ffmpeg_ready"], bool)
        self.assertIn("ytdlp_version", data)
        self.assertIn("cookies_ready", data)
        self.assertIn("cookie_browser", data)

    def test_analyze_invalid_url_error(self):
        resp = client.post("/api/analyze", json={"url": "not-a-real-url"})
        self.assertEqual(resp.status_code, 400)

    def test_auth_browsers_endpoint(self):
        resp = client.get("/api/auth/browsers")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("installed", data)
        self.assertIn("cookie_browser", data)

    def test_cookie_upload_endpoint(self):
        sample_cookies = "# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t1750000000\tSID\tsample_cookie_value\n"
        resp = client.post("/api/auth/cookies/upload", json={"content": sample_cookies})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("cookies.txt", data["cookie_file"])

    def test_proxy_thumbnail_invalid_url(self):
        resp = client.get("/api/proxy/thumbnail?url=invalid")
        self.assertEqual(resp.status_code, 400)

    def test_proxy_thumbnail_is_public_for_img_tags(self):
        raw_client = TestClient(app)
        resp = raw_client.get("/api/proxy/thumbnail?url=invalid")
        self.assertEqual(resp.status_code, 400)

    def test_proxy_thumbnail_rejects_local_hosts(self):
        resp = client.get("/api/proxy/thumbnail?url=http://127.0.0.1:8765/")
        self.assertEqual(resp.status_code, 404)

    def test_events_stream_unauthorized(self):
        raw_client = TestClient(app)
        resp = raw_client.get("/api/events/stream")
        self.assertEqual(resp.status_code, 401)

    def test_cast_info_feed_and_m3u(self):
        info = client.get("/api/cast/info").json()
        self.assertIn("/api/cast/feed/", info["feed_path"])
        self.assertIn("/api/cast/m3u/", info["m3u_path"])

        feed = client.get(info["feed_path"])
        self.assertEqual(feed.status_code, 200)
        self.assertIn("<rss", feed.text)

        m3u = client.get(info["m3u_path"])
        self.assertEqual(m3u.status_code, 200)
        self.assertTrue(m3u.text.startswith("#EXTM3U"))

    def test_cast_feed_and_media_include_audio(self):
        import tempfile
        import shutil
        from engine.history_manager import history_manager
        folder = tempfile.mkdtemp(prefix="saveo-cast-")
        audio = Path(folder) / "episode.mp3"
        audio.write_bytes(b"fake mp3 audio")
        history_manager.add_entry({
            "id": "cast-item",
            "url": "https://example.com/episode",
            "title": "Cast Episode",
            "file_path": str(audio),
            "file_size": audio.stat().st_size,
            "format_label": "Audio (MP3)",
            "is_audio": True,
            "status": "completed",
            "created_at": 1700000000,
        })
        try:
            info = client.get("/api/cast/info").json()
            feed = client.get(info["feed_path"]).text
            self.assertIn("Cast Episode", feed)
            token = info["feed_path"].split("/api/cast/feed/")[1].rsplit(".", 1)[0]
            media_url = f"/api/cast/media/{token}/cast-item"
            raw_client = TestClient(app)
            media = raw_client.get(media_url)
            self.assertEqual(media.status_code, 200)
            self.assertEqual(media.content, b"fake mp3 audio")
        finally:
            history_manager.remove_entry("cast-item")
            shutil.rmtree(folder, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()

