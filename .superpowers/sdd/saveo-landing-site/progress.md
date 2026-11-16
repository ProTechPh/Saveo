# SDD ledger — plan: docs/superpowers/plans/2026-11-16-saveo-landing-site.md

Spec: docs/superpowers/specs/2026-11-16-saveo-landing-site-design.md (read)
Branch: redesign (not main; no worktree created — the two existing modified files
`web/js/api.js` and `android/...` belong to the owner and are left untouched).
Pre-flight: Task 1 produces `site/assets/*.png`; Task 2 consumes those exact names; Task 3 consumes `site/`. No conflicts found.

Task 1: Ruling: the plan named `history.png` for the second capture — captured `formats.png` (populated quality picker) instead, because the History view was empty and the quality list is what the page needs to prove. Cost if wrong: the library/history feature has no screenshot.
Task 1: complete (assets captured from a live `app.py --headless` run; icon downscaled to 256px; 216KB / 77KB / 88KB, all under 400KB)
Task 2: Ruling: screenshots are 520x654 narrow-window captures — the only browser surface here renders at ~530px and there is no Chrome/Edge binary for a wider headless capture. Copy says "narrow window size". Cost if wrong: the hero shows the app's compact layout, not its desktop layout.
Task 2: complete (7 tests pass; runtime check: header CTA 44px, hero CTA 48px, no horizontal scroll at 530px, fine print contrast 7.01)
Task 3: complete (Pages workflow + README badge; YAML re-read by hand — pyyaml is not installed)
Final review: fresh subagent reviewer, 5 Important findings, 0 Critical.
Final: fixed header CTA 36px->44px, fine-print contrast 3.77->7.01, anchor scroll-margin 84px — verified by browser runtime measurement; suite 7/7 green.
Final: Ruling: phone-width screenshots stand with honest copy — a wider capture is impossible in this environment. Cost if wrong: hero shows the compact layout.
Final: minor (deferred): hero image lazy (delays LCP), no `prefers-reduced-motion` guard, logo alt redundant inside a labelled link, no og:image card, CSS assertions are substring-based.

Follow-up request: auto-detect Windows and send them the latest .exe directly.
Ruling: the spec said "no JavaScript" — added one progressive-enhancement file (`site/app.js`) because OS detection and a live release lookup cannot be done statically. Fallback for non-JavaScript and non-Windows visitors is unchanged (release page). Cost if wrong: one extra 1KB request per visitor and a dependency on the GitHub API (falls back silently).
Ruling: the version pill now follows the published release tag instead of `VERSION`, because the repo's VERSION (1.4.4) already lagged the latest release (v1.4.15); the static text stays as the no-JS fallback and the sync test still guards it. Cost if wrong: pill can disagree with `VERSION` in the repo, never with the build users download.
Verified at runtime: both CTAs -> releases/download/v1.4.15/Saveo-Setup.exe (HTTP 200, 87.6MB), hero label "Download installer (.exe)", pills v1.4.15, console clean; suite 10/10 green.

