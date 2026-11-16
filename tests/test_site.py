"""Saveo - landing site checks."""

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"


class TestSiteAssets(unittest.TestCase):

    def test_screenshots_exist_and_are_light(self):
        for name in ("downloader.png", "formats.png", "icon.png"):
            path = SITE / "assets" / name
            self.assertTrue(path.exists(), f"missing {path}")
            self.assertLess(path.stat().st_size, 400_000, f"{name} too heavy")
