"use client";

import { useRef, useState } from "react";
import styles from "../../docs.module.css";

const source = "https://qkjnsxyozetkmorpmxbe.supabase.co/storage/v1/object/public/docs-media/drips-wave/applying-for-issues-15c5f8f8ab5e.mp4";
const chapters = [
  { time: 0, label: "Browse Wave issues", stamp: "0:00" },
  { time: 65, label: "Filter available issues", stamp: "1:05" },
  { time: 110, label: "Read the issue and find Apply", stamp: "1:50" },
  { time: 150, label: "Draft your application", stamp: "2:30" },
  { time: 210, label: "Check your issues and limits", stamp: "3:30" },
];

export default function ApplyingVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  async function jump(time: number) {
    const player = video.current;
    if (!player) return;
    player.currentTime = time;
    player.focus();
    try { await player.play(); } catch { /* Native controls remain available. */ }
  }
  return (
    <>
      <video ref={video} className={styles.walkthroughVideo} controls playsInline preload="metadata" poster="/docs/drips-wave/applying-poster.jpg" width={384} height={832} aria-label="Applying for issues on Drips Wave, five-minute mobile walkthrough" aria-describedby="walkthrough-context" onError={() => setFailed(true)} src={source}>
        Your browser does not support embedded video. <a href={source}>Open the walkthrough</a>.
      </video>
      {failed && <p role="status">The video could not load. <a href={source}>Try opening the video directly</a>, or follow the steps below.</p>}
      <div className={styles.chapters} aria-label="Jump to a part of the video">
        {chapters.map(chapter => <button key={chapter.time} type="button" onClick={() => void jump(chapter.time)}><span><strong>{chapter.label}</strong><small>{chapter.stamp}</small></span></button>)}
      </div>
    </>
  );
}
