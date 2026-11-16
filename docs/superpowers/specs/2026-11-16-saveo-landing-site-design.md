# Saveo Landing Site — Design

Date: 2026-11-16
Status: approved by the project owner

## Intent

Give Saveo a public page that online visitors can open in a browser and understand in ten seconds: what it is, what it does, and where to download it. Today the only "web" surface is `web/`, which is the app's own UI and needs the local Python engine, so it cannot be a public page.

## Goals

- One static page that loads fast on a phone and needs no server.
- Sends visitors to the Windows release download.
- Looks like the product: same dark palette and typography as the app.
- Shows the real app UI, not a mockup.

## Non-goals

- Running the downloader as an online service (legal exposure, hosting cost, abuse).
- Accounts, analytics, cookie banners, newsletter, blog, docs site.
- Multi-language copy; English only, matching the README.
- Android download CTA; Android is mentioned as experimental.

## Anti-goals

- A page that looks like a generic AI landing page or promises features the app does not ship.
- Anything that asks the visitor for a link and pretends to download it in the browser.

## Constraints

- Static files only: HTML + CSS, plus one small progressive-enhancement script (`site/app.js`) that only rewrites download links. No build step, no dependencies. The page must work with JavaScript disabled — every CTA falls back to the releases page.
- Published from `site/` through GitHub Actions Pages (`https://protechph.github.io/Saveo/`); the same folder also drops into Netlify/Vercel if the owner changes hosts.
- Palette and fonts lifted from `web/css/style.css`: amber accent `#e5b04a` on `#0c0c0d`, IBM Plex Sans/Mono.
- Version shown on the page comes from `VERSION` (currently 1.4.4) and a test fails if they diverge.
- Every raster image under 400 KB; screenshots captured at 1200 px wide.

## Approaches considered

1. **Static landing page in `site/`, deployed with GitHub Pages** — chosen. Free, no servers to babysit, no new dependencies, and it matches how the project already ships (GitHub Releases).
2. Reuse the app UI as the public site — rejected: it calls a local API (`server/api.py`) that does not exist for a remote visitor, so it would render broken states.
3. Hosted downloader service — rejected by the owner: needs a 24/7 server, storage, bandwidth, and takes on legal/abuse risk.

## Structure (decided)

Hero with primary download button and one real screenshot → feature cards → second screenshot (library) → supported sources → three-step how-it-works → privacy strip → FAQ → footer with license, GitHub and version.

## Left to the builder

Exact spacing, the card iconography (text/emoji vs inline SVG), and the screenshot framing are the builder's call as long as the page reads as the same product as the desktop app.

## Update 2026-11-16 — Windows auto-detect

Requested by the owner: on a Windows visitor, the download buttons must hand over the latest installer (`.exe`) directly instead of the release page. Implemented as one optional script that reads the latest GitHub release and rewrites the links; non-Windows visitors and anyone with JavaScript off keep the release page. The version pill also takes the released tag, so it cannot drift from the shipped build.
