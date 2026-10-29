export type DownloadKind = "video" | "audio";

export type DownloadFormat = {
  id: string;
  label: string;
  note: string;
  kind: DownloadKind;
  /** Direct URL the browser fetches. Must be CORS-readable. */
  url: string;
  /** Suggested filename for the saved file. */
  filename: string;
  /** Bytes, when the server advertised Content-Length. */
  size: number | null;
  /** MIME type, when known. */
  mime: string | null;
};

export type MediaInfo = {
  title: string;
  uploader: string;
  thumbnail: string | null;
  duration: number | null;
  platform: string;
  webpageUrl: string;
};

export type NoticeTone = "blocked" | "unreadable";

export type ExtractNotice = {
  tone: NoticeTone;
  title: string;
  message: string;
  /** Sites that need a server, for the explanation list. */
  platforms: string[];
};

export type ExtractResult = {
  media: MediaInfo;
  formats: DownloadFormat[];
  /** Set when the link cannot be handed to the browser, with the reason why. */
  notice: ExtractNotice | null;
};

export type SaveProgress = {
  received: number;
  total: number;
};
