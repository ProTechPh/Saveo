"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import type { ExtractResult, SaveProgress } from "@/lib/types";
import { extract, saveToDevice } from "@/lib/client";
import { TopBar } from "./top-bar";
import { Hero } from "./hero";
import { MediaResult } from "./media-result";
import { HistoryDrawer, type HistoryItem } from "./history-drawer";
import { Benefits, Footer, Steps } from "./site-footer";

const HISTORY_KEY = "saveo-history";
const THEME_KEY = "saveo-theme";

export function SaveoApp() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<SaveProgress | null>(null);
  const [error, setError] = useState("");
  const [dark, setDark] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const resultRef = useRef<HTMLDivElement | null>(null);

  /* Theme ------------------------------------------------------------------ */
  const themeReady = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY);
    setDark(saved === "dark");
  }, []);

  useEffect(() => {
    // The inline bootstrap in layout.tsx already painted the saved theme;
    // skip the first pass so we never flash the default on hydration.
    if (!themeReady.current) {
      themeReady.current = true;
      return;
    }
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  }, [dark]);

  /* History ---------------------------------------------------------------- */
  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
    } catch {
      setHistory([]);
    }
  }, []);

  /* Drawer escape key ------------------------------------------------------- */
  useEffect(() => {
    if (!showHistory) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowHistory(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showHistory]);

  const analyze = useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault();
      if (!url.trim()) return;

      setBusy(true);
      setError("");
      setResult(null);
      setProgress(null);

      try {
        const next = await extract(url.trim());
        setResult(next);
        setSelected(next.formats[0]?.id || "");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to read that link.");
      } finally {
        setBusy(false);
      }
    },
    [url],
  );

  useEffect(() => {
    if (!result) return;
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [result]);

  async function paste() {
    try {
      setUrl(await navigator.clipboard.readText());
      setError("");
    } catch {
      setError("Clipboard permission was denied. Paste the link manually.");
    }
  }

  async function download() {
    if (!result) return;
    const format = result.formats.find((item) => item.id === selected) || result.formats[0];
    if (!format) return;

    setError("");
    setSaving(true);
    setProgress({ received: 0, total: format.size || 0 });

    try {
      // The browser reads the bytes and saves them itself. Nothing is uploaded
      // anywhere, and the file never touches a server of ours.
      await saveToDevice(format.url, format.filename, setProgress);

      const item: HistoryItem = {
        id: `${Date.now()}-${format.id}`,
        title: result.media.title,
        filename: format.filename,
        date: new Date().toISOString(),
        preset: format.label,
      };

      setHistory((old) => {
        const updated = [item, ...old].slice(0, 25);
        try {
          localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
        } catch {
          /* storage full or blocked */
        }
        return updated;
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The download did not finish. Check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  function clear() {
    setUrl("");
    setResult(null);
    setSelected("");
    setError("");
    setProgress(null);
  }

  function clearHistory() {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  }

  const selectedFormat = result?.formats.find((item) => item.id === selected) || result?.formats[0];

  return (
    <div className="shell">
      <TopBar
        dark={dark}
        onToggleTheme={() => setDark((value) => !value)}
        onOpenHistory={() => setShowHistory(true)}
        historyCount={history.length}
      />

      <main className="main">
        <Hero
          url={url}
          busy={busy}
          onUrlChange={setUrl}
          onSubmit={analyze}
          onPaste={paste}
          onClear={clear}
        />

        {error && (
          <div className="alert" role="alert">
            <AlertCircle size={17} aria-hidden="true" />
            <span>{error}</span>
            <button type="button" onClick={() => setError("")} aria-label="Dismiss error">
              <X size={14} />
            </button>
          </div>
        )}

        {busy && (
          <section className="result card skeleton" aria-label="Reading link" aria-busy="true">
            <div className="skeleton-preview" />
            <div className="skeleton-body">
              <span className="skeleton-line meta" />
              <span className="skeleton-line title" />
              <span className="skeleton-line meta" />
              <span className="skeleton-line block" />
              <span className="skeleton-line action" />
            </div>
          </section>
        )}

        <div ref={resultRef}>
          {result && !busy && (
            <MediaResult
              media={result.media}
              formats={result.formats}
              notice={result.notice}
              selected={selectedFormat?.id || ""}
              saving={saving}
              progress={progress}
              onSelect={setSelected}
              onDownload={download}
            />
          )}
        </div>

        {!result && !busy && (
          <>
            <Benefits />
            <Steps />
          </>
        )}
      </main>

      <Footer />

      {showHistory && (
        <HistoryDrawer items={history} onClose={() => setShowHistory(false)} onClear={clearHistory} />
      )}
    </div>
  );
}
