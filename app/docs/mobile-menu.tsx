"use client";

import { useRef, useState } from "react";
import { Topics } from "./topics";
import styles from "./docs.module.css";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <div className={styles.mobileMenu} data-open={open} onKeyDown={(event) => {
      if (event.key === "Escape" && open) { setOpen(false); trigger.current?.focus(); }
    }}>
      <button ref={trigger} type="button" className={styles.menuTrigger} aria-expanded={open} aria-controls="mobile-docs-topics" onClick={() => setOpen(!open)}>
        Browse the guide
        <span className={styles.menuIcon} aria-hidden="true"><span /><span /><span /></span>
      </button>
      <div id="mobile-docs-topics" className={styles.menuReveal} inert={!open} onClick={(event) => {
        if ((event.target as HTMLElement).closest("a")) setOpen(false);
      }}>
        <div className={styles.menuClip}><Topics /></div>
      </div>
    </div>
  );
}
