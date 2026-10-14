"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";
import styles from "../../docs.module.css";

const chapters = [
  { label: "Full walkthrough", time: "From the beginning", start: 0 },
  { label: "Applying to issues", time: "2:00–3:13", start: 120, end: 193 },
  { label: "Receiving points", time: "4:20–4:50", start: 260, end: 290 },
  { label: "Withdrawing rewards", time: "5:53–6:39", start: 353, end: 399 },
];

export function WaveVideo() {
  const [selection, setSelection] = useState({ index: 0, revision: 0 });
  const frame = useRef<HTMLIFrameElement>(null);
  const chapter = chapters[selection.index];
  const query = new URLSearchParams({ start: String(chapter.start), playsinline: "1" });
  if (chapter.end !== undefined) query.set("end", String(chapter.end));
  if (selection.revision > 0) query.set("autoplay", "1");

  return (
    <>
      <iframe ref={frame} key={selection.revision} className={styles.video}
        src={`https://www.youtube-nocookie.com/embed/WxrdiLXWtMM?${query}`}
        title={`Drips Wave 101 — ${chapter.label}`} loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen />
      <div className={styles.chapters} role="group" aria-label="Video chapters for scouters">
        {chapters.map((item, index) => (
          <button key={item.start} type="button" aria-pressed={selection.index === index}
            onClick={() => {
              frame.current?.scrollIntoView({ block: "center", behavior: "instant" });
              setSelection((current) => ({ index, revision: current.revision + 1 }));
            }}>
            <Play size={15} aria-hidden="true" /><span><strong>{item.label}</strong><small>{item.time}</small></span>
          </button>
        ))}
      </div>
      <p className={styles.caption} aria-live="polite">Selected: {chapter.label}. Press play if your browser doesn’t start the video automatically.</p>
    </>
  );
}
