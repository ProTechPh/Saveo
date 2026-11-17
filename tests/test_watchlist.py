"""Saveo - watchlist persistence and new-item selection tests."""

import os
import shutil
import tempfile
import unittest
import atexit
from pathlib import Path
from types import SimpleNamespace

_TEST_HOME = tempfile.mkdtemp(prefix="saveo-test-home-")
os.environ["HOME"] = _TEST_HOME
os.environ["USERPROFILE"] = _TEST_HOME
atexit.register(shutil.rmtree, _TEST_HOME, True)

from engine.watchlist_manager import WatchlistManager
from engine.settings_manager import settings_manager


class FakeProvider:
    def get_metadata(self, url):
        return SimpleNamespace(
            is_playlist=True,
            playlist_entries=[
                {"url": "https://example.com/new-1", "title": "New Episode 1", "duration": 1800, "thumbnail": ""},
                {"url": "https://example.com/short", "title": "Short clip", "duration": 30, "thumbnail": ""},
                {"url": "https://example.com/old", "title": "Already downloaded", "duration": 1800, "thumbnail": ""},
                {"url": "https://example.com/new-2", "title": "New Episode 2", "duration": 1200, "thumbnail": ""},
            ],
        )


class FakeRegistry:
    def get_provider_for_url(self, url):
        return FakeProvider()


class FakeQueue:
    def __init__(self, existing=None):
        self.existing = set(existing or [])
        self.added = []

    def find_duplicate(self, url, format_label, is_audio):
        return {"id": "existing"} if url in self.existing else None

    def add_task(self, **kwargs):
        self.added.append(kwargs)
        return SimpleNamespace()

    def save_state(self):
        pass


class TestWatchlist(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        settings_manager.update({"download_dir": self.temp_dir})
        self.state_file = Path(self.temp_dir) / "watchlist.json"

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_add_remove_and_reload(self):
        manager = WatchlistManager(state_file=str(self.state_file))
        item = manager.add(
            "https://example.com/channel",
            quality="1080p",
            folder="Channel",
            max_items=5,
            min_duration=600,
        )
        self.assertEqual(manager.get_all()[0]["format_label"], "1080p FHD")

        reloaded = WatchlistManager(state_file=str(self.state_file))
        self.assertEqual(len(reloaded.get_all()), 1)
        self.assertEqual(reloaded.get_all()[0]["folder"], "Channel")

        self.assertTrue(reloaded.remove(item["id"]))
        self.assertEqual(reloaded.get_all(), [])

    def test_filter_entries(self):
        manager = WatchlistManager(state_file=str(self.state_file))
        entries = FakeProvider().get_metadata("").playlist_entries
        filtered = manager._filter_entries(entries, {
            "min_duration": 600,
            "include": "new",
            "max_items": 5,
        })
        self.assertEqual([entry["url"] for entry in filtered], [
            "https://example.com/new-1",
            "https://example.com/new-2",
        ])

    def test_check_adds_new_and_skips_existing(self):
        manager = WatchlistManager(state_file=str(self.state_file))
        item = manager.add("https://example.com/channel", quality="best", min_duration=600, max_items=10)
        queue = FakeQueue(existing={"https://example.com/old"})

        result = manager.check_item(item, queue, FakeRegistry())

        self.assertEqual(result["checked"], 3)  # short clip filtered out
        self.assertEqual(result["added"], 2)
        self.assertEqual(result["skipped"], 1)
        self.assertEqual({task["url"] for task in queue.added}, {
            "https://example.com/new-1",
            "https://example.com/new-2",
        })
        self.assertGreater(manager.get(item["id"])["last_checked"], 0)


if __name__ == "__main__":
    unittest.main()
