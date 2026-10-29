"use client";

import { Moon, Sun } from "lucide-react";

type TopBarProps = {
  dark: boolean;
  onToggleTheme: () => void;
  onOpenHistory: () => void;
  historyCount: number;
};

export function TopBar({ dark, onToggleTheme, onOpenHistory, historyCount }: TopBarProps) {
  return (
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Saveo home">
        <span className="brand-mark">
          <img src="/icon.svg" alt="" width={26} height={26} />
        </span>
        <span className="brand-name">
          Save<em>o</em>
        </span>
        <span className="brand-tag">v2</span>
      </a>

      <nav className="topbar-nav" aria-label="Primary">
        <a className="topbar-link" href="#how">
          How it works
        </a>
        <button
          className="nav-button"
          onClick={onOpenHistory}
          aria-label={`Open download history${historyCount ? `, ${historyCount} items` : ""}`}
        >
          <span className="nav-label">History</span>
          {historyCount > 0 && <span className="nav-count">{historyCount}</span>}
        </button>
        <button
          className="icon-button"
          onClick={onToggleTheme}
          aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
          aria-pressed={!dark}
        >
          {dark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </nav>
    </header>
  );
}
