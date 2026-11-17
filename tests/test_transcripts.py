"""Saveo - subtitle parser and transcript search tests."""

import shutil
import tempfile
import unittest
import os
import atexit
from pathlib import Path

_TEST_HOME = tempfile.mkdtemp(prefix="saveo-test-home-")
os.environ["HOME"] = _TEST_HOME
os.environ["USERPROFILE"] = _TEST_HOME
atexit.register(shutil.rmtree, _TEST_HOME, True)

from engine.transcripts import find_subtitle_files, parse_subtitles, search_history

SRT = """1
00:00:01,000 --> 00:00:03,500
Hello and welcome to Saveo.

2
00:00:04,000 --> 00:00:06,000
This line mentions offline media.
"""

VTT = """WEBVTT

00:01.000 --> 00:03.000
A <i>VTT</i> subtitle line.
"""


class TestTranscripts(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.media = Path(self.temp_dir) / "Episode 1.mp4"
        self.media.write_bytes(b"video")
        (Path(self.temp_dir) / "Episode 1.en.srt").write_text(SRT, encoding="utf-8")
        (Path(self.temp_dir) / "Episode 1.vtt").write_text(VTT, encoding="utf-8")

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_parse_srt_and_vtt(self):
        srt_cues = parse_subtitles(str(Path(self.temp_dir) / "Episode 1.en.srt"))
        self.assertEqual(len(srt_cues), 2)
        self.assertEqual(srt_cues[0]["start"], 1.0)
        self.assertEqual(srt_cues[1]["text"], "This line mentions offline media.")

        vtt_cues = parse_subtitles(str(Path(self.temp_dir) / "Episode 1.vtt"))
        self.assertEqual(len(vtt_cues), 1)
        self.assertEqual(vtt_cues[0]["text"], "A VTT subtitle line.")

    def test_find_sidecars(self):
        found = find_subtitle_files(str(self.media))
        self.assertEqual(len(found), 2)
        self.assertTrue(all(Path(path).name.startswith("Episode 1") for path in found))

    def test_search_history_and_clip_bounds(self):
        items = [{
            "id": "ep1",
            "title": "Episode 1",
            "file_path": str(self.media),
            "url": "https://example.com/ep1",
            "format_label": "1080p FHD • MP4",
            "is_audio": False,
        }]
        results = search_history(items, "offline")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["start"], 4.0)
        self.assertEqual(results[0]["start_time"], 1.0)
        self.assertEqual(results[0]["end_time"], 9.0)
        self.assertEqual(results[0]["url"], "https://example.com/ep1")

        self.assertEqual(search_history(items, "x"), [])
        self.assertEqual(search_history(items, "no such phrase"), [])


if __name__ == "__main__":
    unittest.main()
