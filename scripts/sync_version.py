"""Propagate the VERSION file to the few places that still hardcode a release string.

Run from the release workflow after VERSION is written, so README/site/local
build defaults cannot drift from the shipped tag. With --finalize, also move
the CHANGELOG "Unreleased" section to the released version.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FINALIZE = "--finalize" in sys.argv
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip().lstrip("v")
if not re.fullmatch(r"\d+\.\d+\.\d+", VERSION):
    sys.exit(f"VERSION is not a valid release version: {VERSION!r}")
TAG = f"v{VERSION}"

# (path, pattern, replacement)
TARGETS = [
    ("site/index.html", r"v\d+\.\d+\.\d+", TAG),
    ("web/index.html", r"v\d+\.\d+\.\d+", TAG),
    ("web/js/app.js", r"'v\d+\.\d+\.\d+'", f"'{TAG}'"),
    ("web/js/api.js", r"v\d+\.\d+\.\d+", TAG),
    ("server/api.py", r'return "v\d+\.\d+\.\d+"', f'return "{TAG}"'),
    ("android/app/src/main/python/saveo_engine.py", r'v\d+\.\d+\.\d+', TAG),
    ("installer.iss", r'#define MyAppVersion "\d+\.\d+\.\d+"', f'#define MyAppVersion "{VERSION}"'),
    ("android/app/build.gradle", r'def appVersionName = "\d+\.\d+\.\d+"', f'def appVersionName = "{VERSION}"'),
]

changed = []
for relative, pattern, replacement in TARGETS:
    path = ROOT / relative
    if not path.exists():
        continue
    text = path.read_text(encoding="utf-8")
    updated = re.sub(pattern, replacement, text)
    if updated != text:
        path.write_text(updated, encoding="utf-8", newline="")
        changed.append(relative)

print(f"Synced {TAG} in {len(changed)} file(s): {', '.join(changed) or 'none'}")

if FINALIZE:
    changelog = ROOT / "CHANGELOG.md"
    if changelog.exists():
        text = changelog.read_text(encoding="utf-8")
        updated = text.replace("## [Unreleased]", f"## [{VERSION}]", 1)
        if updated != text:
            changelog.write_text(updated, encoding="utf-8", newline="")
            print(f"Finalized CHANGELOG section for {VERSION}")
