"""Copy web/ into the Android APK assets so both interfaces stay identical.

Run after editing web/ (or by the release workflow); tests/test_assets_sync.py
fails when the copies diverge.
"""

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "web"
TARGET = ROOT / "android" / "app" / "src" / "main" / "assets" / "web"

if not SOURCE.is_dir():
    raise SystemExit(f"Missing web directory: {SOURCE}")

if TARGET.exists():
    shutil.rmtree(TARGET)
shutil.copytree(SOURCE, TARGET)
print(f"Synced {SOURCE.relative_to(ROOT)} -> {TARGET.relative_to(ROOT)}")
