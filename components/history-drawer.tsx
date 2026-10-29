"use client";

import { Check, History, Trash2, X } from "lucide-react";
import { formatDate } from "@/lib/format";

export type HistoryItem = {
  id: string;
  title: string;
  filename: string;
  date: string;
  preset: string;
};

type HistoryDrawerProps = {
  items: HistoryItem[];
  onClose: () => void;
  onClear: () => void;
};

export function HistoryDrawer({ items, onClose, onClear }: HistoryDrawerProps) {
  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Download history"
    >
      <aside className="drawer">
        <div className="drawer-head">
          <div>
            <span className="drawer-kicker">Stored in this browser</span>
            <h2>Download history</h2>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Close history">
            <X size={16} />
          </button>
        </div>

        {items.length ? (
          <div className="history-list">
            {items.map((item) => (
              <article className="history-item" key={item.id}>
                <span className="history-icon" aria-hidden="true">
                  <Check size={15} strokeWidth={3} />
                </span>
                <div className="history-body">
                  <strong title={item.title}>{item.title}</strong>
                  <p title={item.filename}>{item.filename}</p>
                  <small>{formatDate(item.date)}</small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">
            <span className="empty-icon" aria-hidden="true">
              <History size={30} />
            </span>
            <h3>No downloads yet</h3>
            <p>Completed downloads will appear here.</p>
          </div>
        )}

        {items.length > 0 && (
          <button type="button" className="clear-history" onClick={onClear}>
            <Trash2 size={14} />
            Clear history
          </button>
        )}
      </aside>
    </div>
  );
}
