# Saveo Landing Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single static, responsive landing page at `site/` that shows Saveo to online visitors and sends them to the GitHub release download.

**Architecture:** Plain HTML + one CSS file, no JavaScript and no build step, published by a GitHub Pages workflow. Real UI screenshots captured from the running app (`python app.py --headless`) so the page shows the product, not a mockup.

**Tech Stack:** HTML5, CSS3, Google Fonts (IBM Plex Sans/Mono), GitHub Actions Pages deploy, Python `unittest` for the asset/content checks.

**Spec:** `docs/superpowers/specs/2026-11-16-saveo-landing-site-design.md`

## Global Constraints

- No JavaScript, no framework, no build step, no analytics, no cookie banner.
- English copy. Version string appears exactly as in the `VERSION` file and stays in sync with it.
- Brand tokens copied from `web/css/style.css`: `--bg #0c0c0d`, `--bg-elev #141416`, `--bg-input #0f0f11`, `--line #26262a`, `--line-strong #3a3a41`, `--fg #ececee`, `--fg-muted #9a9aa3`, `--accent #e5b04a`, `--accent-fg #1a1408`.
- Fonts: `'IBM Plex Sans'` for text, `'IBM Plex Mono'` for the version pill and step numbers.
- Every image referenced by the page lives in `site/assets/` and is under 400 KB.
- One download URL for all CTAs: `https://github.com/ProTechPh/Saveo/releases/latest`.
- Page must not scroll horizontally at 360 px width.

## Review Focus

- A phone visitor at 360 px meets no horizontal scroll and a tap-sized Download button (≥44 px tall).
- A visitor on a slow connection: section images carry `width`/`height` and `loading="lazy"` so the layout does not jump.
- A visitor who cannot see images still understands the product: every `<img>` has meaningful `alt`.
- A keyboard-only visitor can reach the Download button and every nav link, and sees a visible focus ring.
- A returning visitor after a release bump: the version pill matches `VERSION`, so a stale pill fails the test suite instead of shipping.

---

### Task 1: Screenshot and brand assets

**Files:**
- Create: `site/assets/downloader.png`
- Create: `site/assets/history.png`
- Create: `site/assets/icon.png` (256 px copy of `assets/icon.png`)
- Test: `tests/test_site.py`

**Interfaces:**
- Produces: `site/assets/downloader.png`, `site/assets/history.png`, `site/assets/icon.png` — referenced by Task 2's `<img src>` values.

- [ ] **Step 1: Write the failing test**

```python
"""Saveo - landing site checks."""

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"


class TestSiteAssets(unittest.TestCase):

    def test_screenshots_exist_and_are_light(self):
        for name in ("downloader.png", "history.png", "icon.png"):
            path = SITE / "assets" / name
            self.assertTrue(path.exists(), f"missing {path}")
            self.assertLess(path.stat().st_size, 400_000, f"{name} too heavy")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest discover -s tests -p test_site.py -v`
Expected: FAIL with "missing ...\site\assets\downloader.png"

- [ ] **Step 3: Start the app and capture the screenshots**

```powershell
Start-Process -FilePath "venv\Scripts\python.exe" -ArgumentList "app.py","--headless","--port","8765"
```

Wait for `http://127.0.0.1:8765` to serve, then with the browser tool: open a tab on that URL, `browser.screenshot` with `fullPage: false`, `maxWidth: 1200`, and copy the returned server-local `path` with `Copy-Item` to `site/assets/downloader.png`. Click the History nav tab, screenshot again into `site/assets/history.png`. Don't capture the settings page (it shows local paths).

- [ ] **Step 4: Downscale the brand icon**

```powershell
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile("$PWD\assets\icon.png")
$bmp = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = 'HighQualityBicubic'
$g.DrawImage($src, 0, 0, 256, 256)
$bmp.Save("$PWD\site\assets\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose(); $src.Dispose()
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m unittest discover -s tests -p test_site.py -v`
Expected: PASS (1 test)

- [ ] **Step 6: Commit**

```bash
git add site/assets tests/test_site.py
git commit -m "feat(site): add landing page assets and asset check"
```

---

### Task 2: The page

**Files:**
- Create: `site/index.html`
- Create: `site/style.css`
- Modify: `tests/test_site.py`

**Interfaces:**
- Consumes: `site/assets/downloader.png`, `site/assets/history.png`, `site/assets/icon.png`.
- Produces: `site/index.html` — the document Task 3 publishes; section ids `features`, `screenshots`, `sources`, `how`, `faq`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_site.py`:

```python
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
        for name in ("assets/downloader.png", "assets/history.png", "assets/icon.png", "style.css"):
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m unittest discover -s tests -p test_site.py -v`
Expected: 6 FAILs on `index.html` / `style.css` not found

- [ ] **Step 3: Write `site/index.html`**

Required content, in this order:

1. `<head>`: `charset`, `viewport`, title `Saveo — Local Media Downloader for Windows`, meta description from the README tagline, favicon `assets/icon.png`, Google Fonts link for IBM Plex Sans 400/500/600 and IBM Plex Mono 500, `<link rel="stylesheet" href="style.css">`.
2. Skip link to `#main`.
3. `<header>`: icon + `Saveo` wordmark, nav links `Features`, `Screenshots`, `Sources`, `FAQ`, and a `Download` button to the release URL. Version pill `v<VERSION>`.
4. Hero: `<h1>Your media. Your quality. Your library.</h1>`, subhead "A local-first video, audio, and social media downloader for Windows. Paste a link, pick a quality, and keep the file — all on your machine.", primary button `Download for Windows`, secondary link `See features` → `#features`, and `site/assets/downloader.png` with `width="1200" height="800" loading="lazy" alt="Saveo downloader with a pasted link, format options and progress"`.
5. `#features`: six cards — *Full quality, every format* (up to 4K video, MP3 up to 320 kbps, M4A, WAV), *Playlists & albums* (each collection into its own folder), *Live progress* (speed, size, ETA, engine status), *Batch queue* (paste many URLs, one queue), *Local library & history*, *Cookies support* (browser session or `cookies.txt` for bot challenges).
6. `#screenshots`: `site/assets/history.png` at `width="1200" height="800" loading="lazy"` with a caption about the local library.
7. `#sources`: text list — YouTube, Instagram, TikTok, Facebook, Reddit, X, Bilibili, and "1,000+ supported sites via yt-dlp".
8. `#how`: three numbered steps — *Paste a link*, *Pick your format*, *Download and keep it*.
9. Privacy strip: "No account, no analytics, no third-party proxy — downloads run on your device."
10. `#faq`: four `<details>` items with plain answers — Is it free? (yes, MIT); Which platforms? (Windows 10/11 stable, Android experimental); Does it run in the browser? (no — it is a desktop app; the site is just the project page); Where do my files go? (your chosen download folder, nothing uploaded).
11. `<footer>`: MIT License link to `LICENSE` on GitHub, GitHub repo link, `v<VERSION>`, "Not affiliated with any media platform."

- [ ] **Step 4: Write `site/style.css`**

Dark theme on the Global Constraints tokens, IBM Plex stack, `max-width: 1100px` content column, buttons at least 44 px tall, `:focus-visible` outline in `--accent`, `img { max-width: 100%; height: auto; }`, features as a responsive grid (`repeat(auto-fit, minmax(260px, 1fr))`), and one `@media (max-width: 720px)` block that stacks the hero, hides the desktop nav links (keep the Download button), and reduces section padding. No animations beyond a `:hover` colour change.

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m unittest discover -s tests -p test_site.py -v`
Expected: PASS (7 tests)

- [ ] **Step 6: Look at it in the browser**

Open `site/index.html` in a browser tab and screenshot it. Check: no horizontal scroll, hero button visible above the fold at 1280×800, the Download button at least 44 px tall, images sharp, text contrast readable. Fix and re-screenshot until it looks right.

- [ ] **Step 7: Commit**

```bash
git add site/index.html site/style.css tests/test_site.py
git commit -m "feat(site): add Saveo landing page"
```

---

### Task 3: Publish it

**Files:**
- Create: `.github/workflows/pages.yml`
- Modify: `README.md` (add a Website badge line to the badge block)

**Interfaces:**
- Consumes: `site/` directory contents from Task 2.
- Produces: deployed site at `https://protechph.github.io/Saveo/`.

- [ ] **Step 1: Write `.github/workflows/pages.yml`**

`on: push` to `main` plus `workflow_dispatch`, `permissions: contents: read, pages: write, id-token: write`, `concurrency: group: pages`. One job: `actions/checkout@v4`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3` with `path: site`, `actions/deploy-pages@v4` in a `github-pages` environment.

- [ ] **Step 2: Add the Website badge to `README.md`**

Insert into the existing badge block, after the License badge:

```markdown
[![Website](https://img.shields.io/badge/Website-Live-e5b04a.svg?style=flat-square)](https://protechph.github.io/Saveo/)
```

- [ ] **Step 3: Validate the workflow**

Run: `python -c "import yaml,pathlib; yaml.safe_load(pathlib.Path('.github/workflows/pages.yml').read_text(encoding='utf-8')); print('ok')"`
Expected: `ok` (add `pyyaml` only if it is already installed; otherwise just re-read the file for indentation)

- [ ] **Step 4: Verify the whole suite**

Run: `python -m unittest discover -s tests -p test_site.py -v`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/pages.yml README.md
git commit -m "ci(site): publish landing page with GitHub Pages"
```

---

## Notes for the executor

- After pushing, GitHub Pages must be set to "GitHub Actions" as the source in repo settings — that is a one-time manual step; report it, don't try to script it.
- If `venv\Scripts\python.exe` is missing, use `python` from PATH.
- Screenshots of a Settings page can leak local paths; use only the downloader and history views.
