"use client";

import { useEffect, useState } from "react";
import { extract, saveToDevice } from "@/lib/client";

const VIDEO = "https://download.samplelib.com/mp4/sample-5s.mp4";
const YT = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";
const HTML = "https://example.com/";

export default function Diag() {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const push = (line: string) => setLines((old) => [...old, line]);

    (async () => {
      try {
        push("== direct mp4 ==");
        const r = await extract(VIDEO);
        push(`formats=${r.formats.length} notice=${r.notice ? r.notice.tone : "null"}`);
        for (const f of r.formats) {
          push(
            `  id=${f.id} label=${f.label} kind=${f.kind} size=${f.size} mime=${f.mime} file=${f.filename}`,
          );
        }
        push(`media.title=${r.media.title} platform=${r.media.platform} duration=${r.media.duration}`);

        push("== youtube ==");
        try {
          const y = await extract(YT);
          push(`formats=${y.formats.length} notice=${y.notice ? `${y.notice.tone} | ${y.notice.title}` : "null"}`);
          push(`platforms=${y.notice ? y.notice.platforms.join(",") : ""}`);
          push(`media.title=${y.media.title} uploader=${y.media.uploader}`);
        } catch (error) {
          push(`threw: ${error}`);
        }

        push("== html page ==");
        try {
          const h = await extract(HTML);
          push(`formats=${h.formats.length} notice=${h.notice ? `${h.notice.tone} | ${h.notice.title}` : "null"}`);
        } catch (error) {
          push(`threw: ${error}`);
        }

        push("== saveToDevice ==");
        let last = 0;
        let events = 0;
        try {
          await saveToDevice(VIDEO, "sample-5s.mp4", (p) => {
            last = p.received;
            events += 1;
          });
          push(`resolved received=${last} progressEvents=${events}`);
        } catch (error) {
          push(`threw: ${error}`);
        }

        push("DONE");
      } catch (error) {
        push(`FATAL: ${error}`);
      }
    })();
  }, []);

  return <pre id="diag">{lines.join("\n")}</pre>;
}
