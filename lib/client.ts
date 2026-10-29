import { formatBytes, formatDuration } from "@/lib/format";
import type { ExtractNotice, ExtractResult, MediaInfo, SaveProgress } from "@/lib/types";

/**
 * Browser-only extraction.
 *
 * Everything here runs in the page. There is no API and no server: we fetch
 * the media ourselves, so the source has to allow cross-origin reads. Streaming
 * sites (YouTube, Instagram, TikTok, ...) do not, and we say so plainly instead
 * of pretending the download will work.
 */

const SERVER_SITES = ["YouTube", "Instagram", "TikTok", "X", "Facebook", "Twitch", "Vimeo"];
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "https://saveo-api.onrender.com").replace(/\/$/, "");

type Platform = {
  name: string;
  match: RegExp;
  /** CORS-friendly oEmbed endpoint, when the provider offers one. */
  oembed: ((url: string) => string) | null;
};

const PLATFORMS: Platform[] = [
  {
    name: "YouTube",
    match: /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/,
    oembed: (url) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
  },
  {
    name: "Vimeo",
    match: /(^|\.)vimeo\.com$/,
    oembed: (url) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`,
  },
  {
    name: "TikTok",
    match: /(^|\.)tiktok\.com$/,
    oembed: (url) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
  },
  { name: "Instagram", match: /(^|\.)instagram\.com$/, oembed: null },
  { name: "Threads", match: /(^|\.)threads\.(net|com)$/, oembed: null },
  { name: "X", match: /(^|\.)(x|twitter)\.com$/, oembed: null },
  { name: "Facebook", match: /(^|\.)(facebook\.com|fb\.watch)$/, oembed: null },
  { name: "Twitch", match: /(^|\.)twitch\.tv$/, oembed: null },
];

const VIDEO_EXT = new Set(["mp4", "webm", "mov", "mkv", "m4v", "avi", "ogv", "flv", "3gp", "ts"]);
const AUDIO_EXT = new Set(["mp3", "m4a", "aac", "opus", "ogg", "oga", "wav", "flac", "weba"]);

const EXT_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-matroska": "mkv",
  "video/ogg": "ogv",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/opus": "opus",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/flac": "flac",
  "audio/webm": "weba",
  "application/mp4": "mp4",
  "application/ogg": "ogg",
};

/* Helpers -------------------------------------------------------------------- */

function extensionFromUrl(url: URL) {
  const name = url.pathname.split("/").pop() || "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  const ext = name.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : "";
}

function filenameFromUrl(url: URL, ext: string) {
  let name = decodeURIComponent(url.pathname.split("/").pop() || "").trim();
  name = name.replace(/[\\/:*?"<>|]+/g, "-");
  if (!name) name = `saveo-${Date.now().toString(36)}`;
  if (!/\.[a-z0-9]{1,5}$/i.test(name)) name = `${name}.${ext}`;
  return name.slice(0, 160);
}

function describe(mime: string, ext: string) {
  const video = mime.startsWith("video/") || (mime === "" && VIDEO_EXT.has(ext));
  const audio = mime.startsWith("audio/") || (mime === "" && AUDIO_EXT.has(ext));
  const kind = audio && !video ? "audio" : "video";
  const label = kind === "audio" && ext === "mp4" ? "M4A" : ext.toUpperCase();
  return { kind, label } as const;
}

function readableMime(value: string) {
  const clean = value.split(";")[0].trim().toLowerCase();
  return EXT_BY_MIME[clean] ? clean : "";
}

/** Reads duration/resolution without downloading: media elements are not CORS-gated. */
function sniffMetadata(url: string, kind: "video" | "audio") {
  return new Promise<{ duration: number | null; height: number | null }>((resolve) => {
    if (typeof document === "undefined") return resolve({ duration: null, height: null });

    const el = document.createElement(kind === "audio" ? "audio" : "video");
    el.preload = "metadata";
    el.muted = true;

    let settled = false;
    const finish = (value: { duration: number | null; height: number | null }) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      el.removeAttribute("src");
      resolve(value);
    };

    const timer = window.setTimeout(() => finish({ duration: null, height: null }), 7000);

    el.addEventListener(
      "loadedmetadata",
      () => {
        const duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : null;
        const height =
          el instanceof HTMLVideoElement && el.videoHeight > 0 ? el.videoHeight : null;
        finish({ duration, height });
      },
      { once: true },
    );
    el.addEventListener("error", () => finish({ duration: null, height: null }), { once: true });

    el.src = url;
  });
}

function needsServer(name: string): ExtractNotice {
  return {
    tone: "blocked",
    title: `${name} needs a server`,
    message:
      "Streaming sites send the video without cross-origin permission, so a page in your browser is not allowed to read the file. Downloading from these needs a server that fetches the bytes for you.",
    platforms: SERVER_SITES,
  };
}

function unreadable(): ExtractNotice {
  return {
    tone: "unreadable",
    title: "No media file at that link",
    message:
      "That link returned a web page, not a video or audio file. Paste a direct file link — something that ends in .mp4, .webm, .mov, .m4a or .mp3.",
    platforms: [],
  };
}

function blockedHost(host: string): ExtractNotice {
  return {
    tone: "blocked",
    title: "This host blocks browser downloads",
    message: `${host} does not send cross-origin permission for its files, so the browser cannot read the bytes. A server-side downloader is needed for this host.`,
    platforms: [],
  };
}

function baseMedia(url: URL, platform: string): MediaInfo {
  return {
    title: filenameFromUrl(url, "mp4"),
    uploader: url.hostname,
    thumbnail: null,
    duration: null,
    platform,
    webpageUrl: url.toString(),
  };
}

/* oEmbed --------------------------------------------------------------------- */

type OEmbed = {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
  provider_name?: string;
  duration?: number;
};

async function fetchOEmbed(endpoint: string): Promise<OEmbed | null> {
  try {
    const response = await fetch(endpoint);
    if (!response.ok) return null;
    return (await response.json()) as OEmbed;
  } catch {
    return null;
  }
}

/* Extraction ----------------------------------------------------------------- */

export async function extract(input: string): Promise<ExtractResult> {
  const raw = input.trim();
  if (!raw) throw new Error("Paste a link first.");

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new Error("That does not look like a link. Include https:// and try again.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https links can be saved.");
  }

  const host = url.hostname.toLowerCase();
  const platform = PLATFORMS.find((entry) => entry.match.test(host));

  // 1. If backend API is configured, use it for streaming sites (or any video url)
  if (API_BASE && platform) {
    try {
      const res = await fetch(`${API_BASE}/api/extract?url=${encodeURIComponent(url.toString())}`);
      if (res.ok) {
        const data: ExtractResult = await res.json();
        if (data.formats && data.formats.length > 0) {
          data.formats = data.formats.map((fmt) => ({
            ...fmt,
            url: fmt.url.startsWith("http") ? fmt.url : `${API_BASE}${fmt.url}`,
          }));
          return data;
        }
      }
    } catch (e) {
      console.warn("Backend extraction failed, falling back to local detection", e);
    }
  }

  // Streaming sites fallback notice if no backend configured
  if (platform) {
    const media = baseMedia(url, platform.name);
    if (platform.oembed) {
      const data = await fetchOEmbed(platform.oembed(url.toString()));
      if (data) {
        if (data.title) media.title = data.title;
        if (data.author_name) media.uploader = data.author_name;
        if (data.thumbnail_url) media.thumbnail = data.thumbnail_url;
        if (typeof data.duration === "number") media.duration = data.duration;
      }
    }
    return { media, formats: [], notice: needsServer(platform.name) };
  }

  // 2. Anything else is treated as a direct file. A plain GET with no custom
  //    headers stays a "simple" request, so no CORS preflight is triggered.
  const controller = new AbortController();
  let response: Response;
  try {
    response = await fetch(url.toString(), { signal: controller.signal });
  } catch {
    controller.abort();
    return { media: baseMedia(url, host), formats: [], notice: blockedHost(host) };
  }

  const headerMime = response.headers.get("content-type") || "";
  const size = Number(response.headers.get("content-length")) || 0;
  const status = response.status;
  controller.abort(); // headers are enough; do not pull the body

  if (!status || status >= 400) {
    return {
      media: baseMedia(url, host),
      formats: [],
      notice: {
        tone: "unreadable",
        title: `The source replied with ${status}`,
        message: "The link is reachable but the server refused the file. Check the link and try again.",
        platforms: [],
      },
    };
  }

  const urlExt = extensionFromUrl(url);
  const mime = readableMime(headerMime);
  const isHtml = /^text\/html/i.test(headerMime) && !mime;

  if (isHtml || (!mime && !VIDEO_EXT.has(urlExt) && !AUDIO_EXT.has(urlExt))) {
    return { media: baseMedia(url, host), formats: [], notice: unreadable() };
  }

  const ext = mime ? EXT_BY_MIME[mime] : urlExt;
  const { kind, label } = describe(mime, ext);
  const filename = filenameFromUrl(url, ext);

  const meta = await sniffMetadata(url.toString(), kind);
  const dimensions =
    kind === "video" && meta.height ? ` · ${meta.height}p` : "";
  const sizeText = size ? ` · ${formatBytes(size)}` : "";

  const media: MediaInfo = {
    title: filename.replace(/\.[a-z0-9]{1,5}$/i, ""),
    uploader: host,
    thumbnail: null,
    duration: meta.duration,
    platform: host,
    webpageUrl: url.toString(),
  };

  return {
    media,
    formats: [
      {
        id: "original",
        label: "Original",
        note: `${label}${dimensions}${sizeText}${meta.duration ? ` · ${formatDuration(meta.duration)}` : ""}`,
        kind,
        url: url.toString(),
        filename,
        size: size || null,
        mime: mime || null,
      },
    ],
    notice: null,
  };
}

/* Saving --------------------------------------------------------------------- */

/**
 * Streams the file into memory and hands it to the browser's download manager.
 * A blob is required because `download` on a cross-origin anchor is ignored.
 */
export async function saveToDevice(
  url: string,
  filename: string,
  onProgress?: (progress: SaveProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`The source replied with ${response.status}.`);

  const total = Number(response.headers.get("content-length")) || 0;
  const mime = response.headers.get("content-type") || "application/octet-stream";

  const chunks: Uint8Array[] = [];
  let received = 0;

  const body = response.body;
  if (!body) {
    chunks.push(new Uint8Array(await response.arrayBuffer()));
    onProgress?.({ received: chunks[0].byteLength, total });
  } else {
    const reader = body.getReader();
    onProgress?.({ received: 0, total });
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.byteLength;
        onProgress?.({ received, total });
      }
    }
  }

  const blob = new Blob(chunks as BlobPart[], { type: mime });
  const objectUrl = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
