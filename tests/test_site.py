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


class TestSitePage(unittest.TestCase):

    def setUp(self):
        self.html = (SITE / "index.html").read_text(encoding="utf-8")
        self.css = (SITE / "style.css").read_text(encoding="utf-8")

    def test_sections_present(self):
        for section_id in ("features", "screenshots", "sources", "how", "faq"):
            self.assertIn(f'id="{section_id}"', self.html)

    def test_download_cta(self):
        self.assertGreaterEqual(
            self.html.count("https://github.com/ProTechPh/Saveo/releases/latest"), 2)
        self.assertIn("Download for Windows", self.html)

    def test_version_matches_version_file(self):
        version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
        self.assertIn(f"v{version}", self.html)

    def test_local_assets_exist(self):
        for name in ("assets/downloader.png", "assets/formats.png", "assets/icon.png", "style.css"):
            self.assertTrue((SITE / name).exists(), f"broken reference: {name}")

    def test_images_are_accessible_and_lazy(self):
        import re
        for tag in re.findall(r"<img\b[^>]*>", self.html):
            for attr in ('alt="', 'loading="lazy"', 'width="', 'height="'):
                self.assertIn(attr, tag)

    def test_responsive_rules(self):
        self.assertIn('name="viewport"', self.html)
        self.assertIn("max-width: 100%", self.css)
        self.assertIn("@media (max-width: 720px)", self.css)
        self.assertIn(":focus-visible", self.css)
