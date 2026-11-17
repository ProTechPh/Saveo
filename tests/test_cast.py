"""Saveo - local podcast feed tests."""

import os
import shutil
import tempfile
import unittest
from pathlib import Path

from server.cast import build_feed, build_m3u


class TestCast(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.audio = Path(self.temp_dir) / "episode.mp3"
        self.audio.write_bytes(b"audio")

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _items(self):
        return [{
            "id": "ep1",
            "title": "Episode <One> & More",
            "is_audio": True,
            "file_path": str(self.audio),
            "file_size": 5,
            "created_at": 1700000000,
            "format_label": "Audio (MP3)",
        }, {
            "id": "video1",
            "title": "Not audio",
            "is_audio": False,
            "file_path": str(self.audio),
        }]

    def test_feed_contains_only_audio_and_escapes(self):
        feed = build_feed(self._items(), "http://127.0.0.1:8765", "token123")
        self.assertIn("<title>Episode &lt;One&gt; &amp; More</title>", feed)
        self.assertIn("/api/cast/media/token123/ep1", feed)
        self.assertNotIn("Not audio", feed)
        self.assertIn("audio/mpeg", feed)
        self.assertTrue(feed.startswith('<?xml version="1.0"'))

    def test_missing_files_are_skipped(self):
        os.remove(self.audio)
        feed = build_feed(self._items(), "http://127.0.0.1:8765", "token123")
        self.assertNotIn("<item>", feed)

    def test_m3u(self):
        m3u = build_m3u(self._items(), "http://127.0.0.1:8765", "token123")
        self.assertTrue(m3u.startswith("#EXTM3U"))
        self.assertIn("#EXTINF:-1,Episode <One> & More", m3u)
        self.assertIn("/api/cast/media/token123/ep1", m3u)


if __name__ == "__main__":
    unittest.main()
