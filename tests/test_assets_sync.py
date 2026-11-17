"""Saveo - web/ and the Android APK asset copy must stay identical."""

import hashlib
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
ANDROID = ROOT / "android" / "app" / "src" / "main" / "assets" / "web"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class TestWebAssetsSync(unittest.TestCase):

    def test_android_assets_match_web(self):
        self.assertTrue(WEB.is_dir(), "missing web/")
        self.assertTrue(ANDROID.is_dir(), "missing Android web assets; run scripts/sync_web_assets.py")

        web_files = {p.relative_to(WEB) for p in WEB.rglob("*") if p.is_file()}
        android_files = {p.relative_to(ANDROID) for p in ANDROID.rglob("*") if p.is_file()}

        self.assertEqual(
            sorted(map(str, web_files)),
            sorted(map(str, android_files)),
            "web/ and Android assets contain different files; run scripts/sync_web_assets.py",
        )
        for relative in sorted(web_files):
            self.assertEqual(
                digest(WEB / relative),
                digest(ANDROID / relative),
                f"{relative} differs between web/ and Android assets",
            )


if __name__ == "__main__":
    unittest.main()
