import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { Brand } from "../ui/brand";
import { ThemeToggle } from "../ui/theme-toggle";
import styles from "./docs.module.css";
import { Topics } from "./topics";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#docs-content">Skip to content</a>
      <header className={styles.header}>
        <div className={styles.identity}><Brand /><span className={styles.divider} /><Link href="/docs" className={styles.label}>Docs</Link></div>
        <div className={styles.actions}><ThemeToggle /><Link href="/scouter/login" className={styles.dashboard}>Dashboard <ArrowUpRight size={15} aria-hidden="true" /></Link></div>
      </header>
      <div className={styles.frame}>
        <aside className={styles.sidebar}><Topics /><p className={styles.sidebarNote}>Your guide to Wave<br />and Plinger.</p></aside>
        <details className={styles.mobileMenu}><summary>Browse the guide <ChevronDown size={16} aria-hidden="true" /></summary><Topics /></details>
        {children}
      </div>
    </div>
  );
}
