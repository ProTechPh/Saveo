"use client";

import { ArrowRight, Clipboard, Link2, LoaderCircle, X } from "lucide-react";

const SAVES = [
  { name: "MP4 · WebM", note: "video" },
  { name: "MOV · MKV", note: "video" },
  { name: "MP3 · M4A", note: "audio" },
  { name: "WAV · FLAC", note: "audio" },
];

const NEEDS_SERVER = [
  { name: "YouTube", note: "no access" },
  { name: "Instagram", note: "no access" },
  { name: "TikTok", note: "no access" },
  { name: "Facebook", note: "no access" },
];

type HeroProps = {
  url: string;
  busy: boolean;
  onUrlChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onPaste: () => void;
  onClear: () => void;
};

export function Hero({ url, busy, onUrlChange, onSubmit, onPaste, onClear }: HeroProps) {
  const disabled = busy || !url.trim();

  return (
    <section className="hero" id="top">
      <div className="hero-grid">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="eyebrow-mark" aria-hidden="true" />
            Saveo — media utility
          </span>

          <h1>
            Save the file.
            <br />
            <em>Nothing in between.</em>
          </h1>

          <p className="hero-sub">
            Paste a direct link to a video or audio file. Your browser reads it and saves it, so the
            file never passes through a server and nothing is stored. Streaming sites need a server —
            we say so instead of pretending.
          </p>

          <div className="hero-actions">
            <form className="search-box" onSubmit={onSubmit} role="search">
              <Link2 className="search-icon" size={18} aria-hidden="true" />

              <label className="sr-only" htmlFor="media-url">
                Media URL
              </label>
              <input
                id="media-url"
                className="search-input"
                value={url}
                onChange={(event) => onUrlChange(event.target.value)}
                placeholder="Paste a direct .mp4, .webm or .mp3 link"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="go"
              />

              {url && (
                <button type="button" className="search-clear" onClick={onClear} aria-label="Clear URL">
                  <X size={15} />
                </button>
              )}

              <div className="search-actions">
                <button type="button" className="search-secondary" onClick={onPaste}>
                  <Clipboard size={14} />
                  Paste
                </button>
                <button type="submit" className="search-primary" disabled={disabled}>
                  {busy ? <LoaderCircle className="spin" size={15} /> : null}
                  {busy ? "Checking" : "Read link"}
                  {!busy && <ArrowRight size={15} aria-hidden="true" />}
                </button>
              </div>
            </form>

            <p className="search-note">
              <kbd>↵</kbd> Enter to read the link · no account · no uploads
            </p>
          </div>
        </div>

        <aside className="hero-index" aria-label="What this page can save">
          <div className="index-group">
            <span className="section-label">Saves here</span>
            <ul className="index-list">
              {SAVES.map((entry) => (
                <li key={entry.name}>
                  <span>{entry.name}</span>
                  <span className="index-note">{entry.note}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="index-group">
            <span className="section-label">Needs a server</span>
            <ul className="index-list">
              {NEEDS_SERVER.map((entry) => (
                <li key={entry.name}>
                  <span>{entry.name}</span>
                  <span className="index-note">{entry.note}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="index-more">Any direct file link works</p>
        </aside>
      </div>
    </section>
  );
}
