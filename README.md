# Saveo

A media downloader that runs entirely in your browser. Paste a direct link to a
video or audio file, and your browser reads it and saves it to your device.

There is no server, no API, no account and no storage. The file never passes
through anything we control — that is a constraint of the design, not a promise.

- **Front end** — Next.js static export (`output: "export"`). Deploy the `out/`
  directory anywhere; it is plain HTML, CSS and JS.
- **No backend.** No environment variables, no database, no object storage.
- **Flow** — the page probes the link for cross-origin readability, sniffs the
  file's real duration and size, then streams the bytes through a `Blob` into
  your downloads folder with a progress bar.

## What it can and cannot save

Downloading a file in a browser is governed by CORS, and this is worth stating
plainly:

| Link type | Works? |
| --- | --- |
| A direct file URL (`.mp4`, `.webm`, `.mov`, `.mkv`, `.m4a`, `.mp3`, `.wav`, `.flac`) from a host that sends `Access-Control-Allow-Origin` | Yes, fully |
| YouTube, Instagram, TikTok, Facebook, Twitch | No |

YouTube and friends serve their media from CDNs that send **no**
`Access-Control-Allow-Origin` header, so a browser is not allowed to read the
bytes. Saveo detects these hosts, shows their metadata, and says "needs a server"
instead of pretending. Extracting those streams genuinely requires a server
running something like yt-dlp.

## Repository layout

```
app/                     pages, layout and stylesheets (App Router, static export)
components/              UI components
lib/client.ts            extract() + saveToDevice() — all the logic
lib/types.ts             shared types
lib/format.ts            formatBytes / formatDuration / formatDate
public/icon.svg          favicon
```

There is no `api/`, no `worker/`, and no build-time configuration.

## Requirements

- Node.js 20.9 or newer
- `pnpm`

## Local development

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm lint       # tsc --noEmit
pnpm build      # static export into out/
```

To preview the exact production output:

```bash
pnpm build
npx serve out
```

**No environment variables are needed.** A static site with no backend has
nothing to configure.

## How it works

`lib/client.ts` holds the whole product, in two functions.

**`extract(input)`**

1. Recognises known streaming hosts and returns their metadata (via oEmbed where
   available) plus a "needs a server" notice.
2. For anything else, issues a deliberately CORS-**simple** `fetch` — no custom
   headers, so the browser does not send a preflight — and reads only
   `Content-Type` and `Content-Length`. The response body is aborted immediately;
   nothing is downloaded yet.
3. Validates that the result really is media (a known MIME type, or a media
   extension when the host is vague).
4. Attaches a detached `<video preload="metadata">` element to read the true
   duration and resolution cross-origin (playback metadata is not CORS-gated;
   only canvas reads are).

It returns either one `original` format or one explanatory notice.

**`saveToDevice(url, filename, onProgress)`**

`fetch`es the URL with a streaming reader, reports bytes as they arrive, collects
the chunks into a `Blob`, and clicks a hidden `<a download>`. The blob round-trip
is required: the browser ignores the `download` attribute on a cross-origin
anchor, so streaming straight to the anchor would navigate instead of save.

Loading and error states are handled in `components/saveo-app.tsx`;
`components/media-result.tsx` renders the format card, the progress bar and the
notice panel.

## History

Download history is kept in the browser's `localStorage` under `saveo-history`
(25 entries, never uploaded). Clearing it removes it permanently.

## Deployment

See [DEPLOY.md](DEPLOY.md). Short version: deploy the static export to Vercel or
any static host. Nothing else is involved.

## Legal

Only download media you own or are authorized to save. Users are responsible for
copyright law and the terms of the sites they use.

## License

[MIT](LICENSE)
