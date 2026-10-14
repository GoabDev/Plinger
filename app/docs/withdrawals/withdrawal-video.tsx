"use client";

import { useRef, useState } from "react";
import styles from "../docs.module.css";

type Props = { src: string; poster: string; title: string; landscape?: boolean; chapters: { time: number; label: string; stamp: string }[] };

export default function WithdrawalVideo({ src, poster, title, landscape = false, chapters }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  async function jump(time: number) {
    const player = video.current;
    if (!player) return;
    if (player.readyState < 1) {
      player.addEventListener("loadedmetadata", () => { player.currentTime = time; }, { once: true });
    } else { player.currentTime = time; }
    player.focus();
    try { await player.play(); } catch { /* Use the native play control if playback is blocked. */ }
  }
  return <>
    <video ref={video} className={landscape ? styles.video : styles.walkthroughVideo} controls playsInline preload="metadata" poster={poster} width={landscape ? 1920 : 384} height={landscape ? 1080 : 832} src={src} aria-label={title} onError={() => setFailed(true)}>
      Your browser does not support embedded video. <a href={src}>Open the walkthrough</a>.
    </video>
    {failed && <p role="status">The video could not load. <a href={src}>Open it directly</a> or follow the written steps below.</p>}
    <div className={styles.chapters} aria-label={`${title} chapters`}>{chapters.map(chapter => <button key={chapter.time} type="button" onClick={() => void jump(chapter.time)}><span><strong>{chapter.label}</strong><small>{chapter.stamp}</small></span></button>)}</div>
  </>;
}
