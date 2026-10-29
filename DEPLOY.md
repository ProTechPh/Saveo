# Deploying Saveo

Saveo is a single static site. There is no server, no API, no database and no
environment variable to set. Deployment is one step.

## Vercel

```bash
vercel
# or import the repo at vercel.com/new
```

Settings:

- **Root directory**: repository root.
- **Framework preset**: Next.js. `next.config.ts` sets `output: "export"`, so the
  build writes a fully static site into `out/` and Vercel serves it from its CDN.
- **Environment variables**: none. Leave the section empty.

The Vercel Hobby plan is enough — the whole thing is static files.

## Any other static host

Because the build is a static export, `out/` can be served by anything:

```bash
pnpm build
# then upload the contents of out/
```

That includes Netlify, Cloudflare Pages, GitHub Pages, S3 + CloudFront, or a
plain nginx box. No rewrites or redirects are required; the site is a single
route plus a `404.html`.

## Before you ship

```bash
pnpm lint     # tsc --noEmit
pnpm build    # static export into out/
npx serve out # check the real output locally
```

Then open the local preview and paste a direct file link from a host that sends
`Access-Control-Allow-Origin` (for example
`https://download.samplelib.com/mp4/sample-5s.mp4`) to confirm the download
completes.

## What will not work in production, by design

YouTube, Instagram, TikTok and Facebook links show a "needs a server" notice.
Their media CDNs send no `Access-Control-Allow-Origin` header, so no browser is
permitted to read those bytes. Adding a backend is the only way to support them —
nothing in this deployment can change that.

## Troubleshooting

**"This host blocks browser downloads"**
The host does not send `Access-Control-Allow-Origin`, or the request failed.
There is no client-side workaround; the server has to allow it.

**"No media file at that link"**
The URL returned HTML or an unknown content type. It is a web page, not a file —
use a link that points directly at the media.

**A download starts but the file is corrupt**
Some hosts return partial content for range requests. Re-run the download; if it
persists, the source does not support the streaming read.

**Metadata is missing (no duration or resolution)**
The source does not report metadata that a `<video>` element can read. The file
still saves normally.

**Stale copy after a redeploy**
The site is static, so a hard refresh (or a CDN purge) clears it. There is no
server-side cache to worry about.
