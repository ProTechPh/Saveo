"""
Saveo - Automated Comprehensive Engine & API Test Suite
Validates core providers, platform detection, file manager, queue, settings, history, and REST API.
"""

import os
import sys
import shutil
import tempfile
import threading
import unittest
import atexit
from pathlib import Path

# Keep queue/settings/history writes out of the developer's real ~/.saveo.
_TEST_HOME = tempfile.mkdtemp(prefix="saveo-test-home-")
os.environ["HOME"] = _TEST_HOME
os.environ["USERPROFILE"] = _TEST_HOME
atexit.register(shutil.rmtree, _TEST_HOME, True)

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

from engine.providers.registry import registry
from engine.providers.ytdlp_provider import humanize_error, YtDlpProvider, _mp4_duration_seconds, _is_transient_error
from engine.file_manager import sanitize_filename, apply_filename_template, get_unique_filename, format_bytes, format_seconds
from engine.settings_manager import SettingsManager
from engine.history_manager import HistoryManager
from engine.queue_manager import QueueManager, DownloadTask, queue_manager


class TestSaveoCore(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_url_validation_and_platform_detection(self):
        """Test URL validation and fast regex platform detection."""
        test_cases = [
            ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", True, "YouTube"),
            ("https://youtu.be/dQw4w9WgXcQ", True, "YouTube"),
            ("https://x.com/OpenAI/status/123456789", True, "Twitter / X"),
            ("https://twitter.com/user/status/123", True, "Twitter / X"),
            ("https://www.tiktok.com/@user/video/123456", True, "TikTok"),
            ("https://www.bilibili.tv/en/video/123456", True, "Bilibili"),
            ("https://www.reddit.com/r/videos/comments/xyz", True, "Reddit"),
            ("https://vimeo.com/76979871", True, "Vimeo"),
            ("https://soundcloud.com/artist/track", True, "SoundCloud"),
            ("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", True, "Direct MP4 File"),
            ("not-a-valid-url", False, "Unknown"),
            ("", False, "Unknown"),
        ]

        for url, expected_valid, expected_platform in test_cases:
            valid = registry.is_valid_url(url)
            self.assertEqual(valid, expected_valid, f"Failed validation for {url}")
            if valid:
                platform = registry.detect_platform(url)
                self.assertEqual(platform, expected_platform, f"Failed platform detect for {url}")

    def test_filename_sanitization(self):
        """Test invalid filesystem characters removal and length truncation."""
        dirty_name = 'My: Cool / Video? *with* <illegal> |chars| & "quotes"'
        clean = sanitize_filename(dirty_name)
        self.assertNotIn(':', clean)
        self.assertNotIn('/', clean)
        self.assertNotIn('?', clean)
        self.assertNotIn('*', clean)
        self.assertNotIn('<', clean)
        self.assertNotIn('>', clean)
        self.assertNotIn('|', clean)
        self.assertNotIn('"', clean)
        self.assertTrue(len(clean) > 0)

        # Empty fallback
        self.assertEqual(sanitize_filename(""), "saveo_media")

    def test_duplicate_filename_collision(self):
        """Test collision resolution: Video.mp4 -> Video (1).mp4 -> Video (2).mp4."""
        test_file = Path(self.temp_dir) / "TestVideo.mp4"
        test_file.write_text("dummy")

        candidate1 = get_unique_filename(self.temp_dir, "TestVideo.mp4")
        self.assertEqual(candidate1, "TestVideo (1).mp4")

        (Path(self.temp_dir) / candidate1).write_text("dummy2")
        candidate2 = get_unique_filename(self.temp_dir, "TestVideo.mp4")
        self.assertEqual(candidate2, "TestVideo (2).mp4")

    def test_formatting_utilities(self):
        """Test byte and seconds formatting."""
        self.assertEqual(format_bytes(500), "500.0 B")
        self.assertEqual(format_bytes(1024), "1.0 KB")
        self.assertEqual(format_bytes(1024 * 1024 * 5), "5.0 MB")
        self.assertEqual(format_bytes(1024 * 1024 * 1024 * 2), "2.0 GB")

        self.assertEqual(format_seconds(45), "00:45")
        self.assertEqual(format_seconds(125), "02:05")
        self.assertEqual(format_seconds(3665), "01:01:05")

    def test_filename_template(self):
        """The {title} template is applied and sanitized by both providers."""
        self.assertEqual(apply_filename_template("{title} [Saveo]", "My: Video"), "My Video [Saveo]")
        self.assertEqual(apply_filename_template("", "Plain Title"), "Plain Title")
        self.assertEqual(apply_filename_template("{title}", ""), "saveo_media")

    def test_cancel_clears_paused_flag(self):
        """A paused task that is then cancelled must not stay paused on retry."""
        task = DownloadTask(
            url="https://example.com/video.mp4",
            title="Sample",
            output_dir=self.temp_dir,
        )
        task.pause()
        self.assertTrue(task.is_paused())
        task.cancel()
        self.assertFalse(task.is_paused())
        self.assertEqual(task.status, "cancelled")

    def test_chapters_are_normalized(self):
        """Source chapters become title + start/end entries for the clip picker."""
        provider = YtDlpProvider()
        chapters = provider._parse_chapters({
            "chapters": [
                {"start_time": 0, "end_time": 61.5, "title": "Intro"},
                {"start_time": 61.5, "title": ""},
                {"title": "Missing start"},
            ]
        })
        self.assertEqual(len(chapters), 2)
        self.assertEqual(chapters[0]["title"], "Intro")
        self.assertEqual(chapters[0]["end_time"], 61.5)
        self.assertEqual(chapters[1]["title"], "Chapter 2")
        self.assertIsNone(chapters[1]["end_time"])

    def test_advanced_video_formats(self):
        """Exact streams are exposed for the advanced picker, video-only flagged."""
        provider = YtDlpProvider()
        raw = [
            {"format_id": "137", "height": 1080, "width": 1920, "fps": 30,
             "vcodec": "avc1.640028", "acodec": "none", "ext": "mp4", "filesize": 1000, "tbr": 4000},
            {"format_id": "18", "height": 360, "width": 640, "fps": 30,
             "vcodec": "avc1.42001E", "acodec": "mp4a.40.2", "ext": "mp4", "filesize": 500, "tbr": 800},
            {"format_id": "251", "height": 0, "vcodec": "none", "acodec": "opus", "ext": "webm"},
        ]
        advanced = provider._parse_advanced_formats(raw)
        ids = [item["format_id"] for item in advanced]
        self.assertEqual(ids[0], "137")
        self.assertIn("18", ids)
        self.assertNotIn("251", ids)

        video_only = next(item for item in advanced if item["format_id"] == "137")
        self.assertFalse(video_only["has_audio"])
        self.assertIn("AVC1", video_only["label"])
        self.assertIn("1080p", video_only["label"])

    def test_audio_format_distinct_sizes(self):
        """Test that distinct AAC and Opus streams yield distinct estimated sizes."""
        provider = YtDlpProvider()
        raw_formats = [
            {"vcodec": "none", "acodec": "mp4a.40.2", "ext": "m4a", "abr": 128, "filesize": 35000000},
            {"vcodec": "none", "acodec": "opus", "ext": "webm", "abr": 160, "filesize": 44200000},
        ]
        audio_fmts = provider._parse_audio_formats(raw_formats, duration=2000)
        sizes = {f.ext: f.filesize_approx for f in audio_fmts}
        self.assertEqual(sizes["m4a"], 35000000)
        self.assertEqual(sizes["opus"], 44200000)
        self.assertNotEqual(sizes["m4a"], sizes["opus"])
        self.assertGreater(sizes["wav"], sizes["mp3"])

    def test_humanize_errors(self):
        """Test friendly user error translation."""
        err_403 = humanize_error("HTTP Error 403: Forbidden")
        self.assertIn("rejected", err_403["friendly"].lower())

        err_drm = humanize_error("This video is DRM protected")
        self.assertIn("drm", err_drm["friendly"].lower())

        err_priv = humanize_error("Private video. Sign in to view.")
        self.assertIn("private", err_priv["friendly"].lower())

        err_bot = humanize_error("Sign in to confirm you're not a bot. Use --cookies-from-browser or --cookies")
        self.assertIn("bot", err_bot["friendly"].lower())
        self.assertIn("cookies", err_bot["suggestion"].lower())

        err_bili = humanize_error("[BiliIntl] This video is only available for registered users.")
        self.assertIn("bilibili", err_bili["friendly"].lower())
        self.assertIn("cookies", err_bili["suggestion"].lower())

        err_html = humanize_error("The extracted extension ('html') is unusual and will be skipped")
        self.assertIn("web page", err_html["friendly"].lower())

        err_unavail = humanize_error("ERROR: [youtube] 0W3QSijwJOO: This video is unavailable")
        self.assertIn("unavailable", err_unavail["friendly"].lower())
        self.assertIn("typo", err_unavail["suggestion"].lower())

    def test_settings_persistence(self):
        """Test persistent settings saving and retrieval."""
        cfg_dir = Path(self.temp_dir) / "config"
        sm = SettingsManager(cfg_dir)
        defaults = sm.get_all()
        self.assertIn("download_dir", defaults)
        self.assertIn("cookie_file", defaults)
        self.assertEqual(defaults["max_concurrent_downloads"], 3)

        sm.update({"max_concurrent_downloads": 4, "theme": "oled", "cookie_file": "C:/path/cookies.txt"})
        sm_reloaded = SettingsManager(cfg_dir)
        self.assertEqual(sm_reloaded.get("max_concurrent_downloads"), 4)
        self.assertEqual(sm_reloaded.get("theme"), "oled")
        self.assertEqual(sm_reloaded.get("cookie_file"), "C:/path/cookies.txt")

        # Out-of-range concurrency is clamped instead of stopping the queue.
        sm_reloaded.update({"max_concurrent_downloads": 99})
        self.assertEqual(sm_reloaded.get("max_concurrent_downloads"), 5)
        sm_reloaded.update({"max_concurrent_downloads": 0})
        self.assertEqual(sm_reloaded.get("max_concurrent_downloads"), 1)

        sm_reloaded.update({"fragment_concurrency": 99, "rate_limit_kbps": -100})
        self.assertEqual(sm_reloaded.get("fragment_concurrency"), 8)
        self.assertEqual(sm_reloaded.get("rate_limit_kbps"), 0)

        sm_reloaded.update({"subtitle_langs": "en, fil<script>", "subtitle_mode": "weird"})
        self.assertNotIn("<", sm_reloaded.get("subtitle_langs"))
        self.assertEqual(sm_reloaded.get("subtitle_mode"), "sidecar")

        sm_reloaded.update({"schedule_start": "99:99", "schedule_stop": "06:30", "schedule_enabled": 1})
        self.assertEqual(sm_reloaded.get("schedule_start"), "01:00")
        self.assertEqual(sm_reloaded.get("schedule_stop"), "06:30")
        self.assertTrue(sm_reloaded.get("schedule_enabled"))

    def test_history_manager(self):
        """Test download history recording, listing, and deletion."""
        hist_dir = Path(self.temp_dir) / "history"
        hm = HistoryManager(hist_dir)

        dummy_entry = {
            "id": "item-101",
            "title": "Awesome Sample Video",
            "url": "https://example.com/video.mp4",
            "platform": "Direct",
            "filename": "Awesome Sample Video.mp4",
            "file_size": 15000000,
            "format_label": "1080p FHD • MP4",
            "format_id": "1080p",
            "audio_format": "mp3",
            "status": "completed"
        }
        hm.add_entry(dummy_entry)

        items = hm.get_all()
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["id"], "item-101")
        self.assertEqual(items[0]["title"], "Awesome Sample Video")
        self.assertEqual(items[0]["format_id"], "1080p")
        self.assertEqual(items[0]["audio_format"], "mp3")

        # Remove entry
        res = hm.remove_entry("item-101")
        self.assertTrue(res)
        self.assertEqual(len(hm.get_all()), 0)

    def test_history_concurrent_writes(self):
        """Completion callbacks from several workers must not lose or corrupt entries."""
        hist_dir = Path(self.temp_dir) / "history-concurrent"
        hm = HistoryManager(hist_dir)

        def add(i):
            hm.add_entry({"id": f"item-{i}", "title": f"Video {i}"})

        threads = [threading.Thread(target=add, args=(i,)) for i in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(len(hm.get_all()), 20)
        self.assertEqual(len(HistoryManager(hist_dir).get_all()), 20)

    def test_history_duplicate_lookup(self):
        """Duplicate detection matches URL + format + media type, nothing looser."""
        hist_dir = Path(self.temp_dir) / "history-duplicates"
        hm = HistoryManager(hist_dir)
        hm.add_entry({
            "id": "dup-1",
            "url": "https://example.com/watch/1",
            "format_label": "1080p FHD • MP4",
            "is_audio": False,
            "status": "completed",
            "filename": "sample.mp4",
        })

        self.assertIsNotNone(hm.find_duplicate("https://example.com/watch/1", "1080p FHD • MP4", False))
        self.assertIsNone(hm.find_duplicate("https://example.com/watch/1", "720p HD • MP4", False))
        self.assertIsNone(hm.find_duplicate("https://example.com/watch/1", "1080p FHD • MP4", True))

    def test_queue_state_persists_and_restores(self):
        """Queued and paused tasks survive a restart; running tasks return as queued."""
        state_file = Path(self.temp_dir) / "queue.json"
        qm = QueueManager(state_file=str(state_file), start_worker=False)
        queued = qm.add_task(
            url="https://example.com/a",
            title="A",
            format_label="1080p FHD • MP4",
            format_id="1080p",
            output_dir=self.temp_dir,
        )
        paused = qm.add_task(
            url="https://example.com/b",
            title="B",
            format_label="720p HD • MP4",
            output_dir=self.temp_dir,
        )
        qm.pause_task(paused.id)
        queued.status = "downloading"
        qm._save_state()

        self.assertTrue(state_file.exists())
        restored = QueueManager(state_file=str(state_file), start_worker=False)
        tasks = {t["id"]: t for t in restored.get_all_tasks()}
        self.assertEqual(set(tasks), {queued.id, paused.id})
        self.assertEqual(tasks[queued.id]["status"], "queued")
        self.assertEqual(tasks[queued.id]["format_id"], "1080p")
        self.assertEqual(tasks[paused.id]["status"], "paused")

        duplicate = restored.find_duplicate("https://example.com/a", "1080p FHD • MP4", False)
        self.assertIsNotNone(duplicate)
        self.assertEqual(duplicate["duplicate_source"], "queue")

    def test_provenance_sidecar_written(self):
        """Completed downloads write a hash receipt next to the media file."""
        media = Path(self.temp_dir) / "provenance.mp4"
        media.write_bytes(b"saveo provenance")
        task = DownloadTask(
            url="https://example.com/provenance",
            title="Provenance",
            output_dir=self.temp_dir,
            format_label="1080p FHD • MP4",
        )
        task.file_path = str(media)
        task.file_size = media.stat().st_size

        queue_manager._finalize_provenance(task)

        receipt = Path(f"{media}.saveo.json")
        self.assertTrue(receipt.exists())
        import json
        data = json.loads(receipt.read_text(encoding="utf-8"))
        self.assertEqual(data["source_url"], "https://example.com/provenance")
        self.assertEqual(len(data["sha256"]), 64)

    def test_queue_task_lifecycle(self):
        """Test queue task state changes, cancellation and retrying."""
        qm = QueueManager()
        task = qm.add_task(
            url="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            title="Sample Video",
            output_dir=self.temp_dir
        )
        self.assertIsNotNone(task)
        self.assertEqual(task.status, "queued")

        # Cancel task
        qm.cancel_task(task.id)
        self.assertEqual(task.status, "cancelled")

        # Retry task
        qm.retry_task(task.id)
        self.assertEqual(task.status, "queued")

        # Remove task
        qm.remove_task(task.id)
        self.assertIsNone(qm.get_task(task.id))

    def test_transient_error_classification(self):
        """Auth/HTML failures should not be retried (they double the console noise)."""
        self.assertFalse(_is_transient_error("[BiliIntl] only available for registered users"))
        self.assertFalse(_is_transient_error("The extracted extension ('html') is unusual"))
        self.assertFalse(_is_transient_error("Private video. Sign in"))
        self.assertTrue(_is_transient_error("HTTP Error 403: Forbidden"))
        self.assertTrue(_is_transient_error("Connection timed out"))

    def test_mp4_mvhd_duration_parsing(self):
        """Instagram reels omit duration, so it is read from the MP4 mvhd atom."""
        # version 0 mvhd: timescale 600, duration 3012 frames -> 5s
        v0 = b'\x00\x00\x00\x6c' + b'mvhd' + b'\x00\x00\x00\x00' + b'\x00' * 8 + \
            (600).to_bytes(4, 'big') + (3012).to_bytes(4, 'big') + b'\x00' * 80
        self.assertEqual(_mp4_duration_seconds(v0), 5)
        # version 1 mvhd: 64-bit times and duration
        v1 = b'\x00\x00\x00\x78' + b'mvhd' + b'\x01\x00\x00\x00' + b'\x00' * 16 + \
            (90000).to_bytes(4, 'big') + (2700000).to_bytes(8, 'big') + b'\x00' * 60
        self.assertEqual(_mp4_duration_seconds(v1), 30)
        # Nothing to read
        self.assertEqual(_mp4_duration_seconds(b'not a video'), 0)
        # Fragmented MP4: mvhd duration 0, real length in mvex/mehd (timescale 1000)
        fmp4 = b'\x00\x00\x00\x6c' + b'mvhd' + b'\x00\x00\x00\x00' + b'\x00' * 8 + \
            (1000).to_bytes(4, 'big') + (0).to_bytes(4, 'big') + b'\x00' * 80 + \
            b'mvex' + b'\x00\x00\x00\x10' + b'mehd' + b'\x00\x00\x00\x00' + (4967).to_bytes(4, 'big')
        self.assertEqual(_mp4_duration_seconds(fmp4), 5)


if __name__ == "__main__":
    unittest.main()

