"use client";

import { Download, FileWarning, LoaderCircle, ShieldAlert, ShieldCheck, Video } from "lucide-react";
import type { DownloadFormat, ExtractNotice, MediaInfo, SaveProgress } from "@/lib/types";
import { formatBytes, formatDuration } from "@/lib/format";
import { QualityPicker } from "./quality-picker";

type MediaResultProps = {
  media: MediaInfo;
  formats: DownloadFormat[];
  notice: ExtractNotice | null;
  selected: string;
  saving: boolean;
  progress: SaveProgress | null;
  onSelect: (id: string) => void;
  onDownload: () => void;
};

function percentOf(progress: SaveProgress | null) {
  if (!progress || !progress.total) return null;
  return Math.max(0, Math.min(100, Math.round((progress.received / progress.total) * 100)));
}

export function MediaResult({
  media,
  formats,
  notice,
  selected,
  saving,
  progress,
  onSelect,
  onDownload,
}: MediaResultProps) {
  const chosen = formats.find((item) => item.id === selected) || formats[0];
  const percent = percentOf(progress);
  const downloadable = formats.length > 0;

  const kickerIcon = downloadable ? (
    <ShieldCheck size={13} aria-hidden="true" />
  ) : notice?.tone === "blocked" ? (
    <ShieldAlert size={13} aria-hidden="true" />
  ) : (
    <FileWarning size={13} aria-hidden="true" />
  );

  const kickerText = downloadable
    ? "Ready to save"
    : notice?.tone === "blocked"
      ? "Needs a server"
      : "Nothing to save";

  return (
    <section className="result card" aria-label="Media analysis result">
      <div className="preview">
        {media.thumbnail ? (
          <img src={media.thumbnail} alt="" referrerPolicy="no-referrer" />
        ) : (
          <Video className="preview-fallback" size={44} aria-hidden="true" />
        )}

        <div className="preview-badges">
          <span className="badge">{media.platform}</span>
          {media.duration ? (
            <span className="badge badge-duration">{formatDuration(media.duration)}</span>
          ) : null}
        </div>
      </div>

      <div className="details">
        <div className="media-heading">
          <div className="media-heading-text">
            <span className="media-kicker">
              {kickerIcon}
              {kickerText}
            </span>
            <h2>{media.title}</h2>
            <p className="media-meta">
              <strong>{media.uploader}</strong>
              {media.duration ? (
                <>
                  <span className="media-meta-dot" aria-hidden="true" />
                  <span>{formatDuration(media.duration)}</span>
                </>
              ) : null}
              {media.platform ? (
                <>
                  <span className="media-meta-dot" aria-hidden="true" />
                  <span>{media.platform}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>

        <div className="divider" />

        {downloadable ? (
          <>
            <QualityPicker
              formats={formats}
              selected={selected}
              disabled={saving}
              onChange={onSelect}
            />

            <button
              type="button"
              className="download-button"
              onClick={onDownload}
              disabled={saving}
            >
              {saving ? (
                <LoaderCircle className="spin" size={18} aria-hidden="true" />
              ) : (
                <Download size={18} aria-hidden="true" />
              )}
              {saving ? "Saving to your device..." : `Download ${chosen?.label || "media"}`}
            </button>

            {saving && (
              <div className="save-progress" role="status" aria-live="polite">
                <div className="save-progress-head">
                  <span className="save-progress-label">
                    {progress?.total ? "Saving to your device" : "Reading the file"}
                  </span>
                  <span className="save-progress-value">
                    {percent === null
                      ? progress && progress.received
                        ? formatBytes(progress.received)
                        : "…"
                      : `${percent}%`}
                  </span>
                </div>
                <div className="save-track">
                  <i
                    className={percent === null ? "save-fill indeterminate" : "save-fill"}
                    style={percent === null ? undefined : { width: `${percent}%` }}
                  />
                </div>
              </div>
            )}

            <p className="download-note">
              Your browser reads the file and saves it. Nothing is uploaded to a server.
            </p>
          </>
        ) : (
          notice && (
            <div className={`notice notice-${notice.tone}`} role="note">
              <h3>{notice.title}</h3>
              <p>{notice.message}</p>
              {notice.platforms.length > 0 && (
                <ul className="notice-list">
                  {notice.platforms.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              )}
            </div>
          )
        )}
      </div>
    </section>
  );
}
