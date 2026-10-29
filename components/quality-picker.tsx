"use client";

import { Check, Headphones, Video } from "lucide-react";
import type { DownloadFormat } from "@/lib/types";

type QualityPickerProps = {
  formats: DownloadFormat[];
  selected: string;
  disabled?: boolean;
  onChange: (id: string) => void;
};

export function QualityPicker({ formats, selected, disabled, onChange }: QualityPickerProps) {
  const groups = [
    { title: "Video", kind: "video" as const, Icon: Video },
    { title: "Audio only", kind: "audio" as const, Icon: Headphones },
  ];

  return (
    <>
      {groups.map(({ title, kind, Icon }) => {
        const options = formats.filter((item) => item.kind === kind);
        if (!options.length) return null;

        return (
          <div className="quality-group" key={kind}>
            <span className="section-label">
              <Icon size={12} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />
              {title}
            </span>
            <div className="quality-grid" role="radiogroup" aria-label={title}>
              {options.map((option) => {
                const active = option.id === selected;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`quality-option${active ? " selected" : ""}`}
                    disabled={disabled}
                    onClick={() => onChange(option.id)}
                  >
                    <span className="quality-top">
                      <Icon size={16} aria-hidden="true" />
                      <span className="quality-label">{option.label}</span>
                    </span>
                    <span className="quality-note">{option.note}</span>
                    {active && (
                      <Check className="quality-check" size={13} strokeWidth={3} aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
