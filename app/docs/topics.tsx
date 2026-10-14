"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CircleDot, KeyRound, Network, UserPlus, Wallet, Waves } from "lucide-react";
import styles from "./docs.module.css";

export function Topics() {
  const pathname = usePathname();
  return (
    <nav aria-label="Documentation topics" className={styles.topics}>
      <p>INTRODUCTION</p>
      <Link href="/docs" aria-current={pathname === "/docs" ? "page" : undefined}><BookOpen size={16} aria-hidden="true" /> Drips Wave</Link>
      <Link href="/docs/plinger" aria-current={pathname === "/docs/plinger" ? "page" : undefined}><Network size={16} aria-hidden="true" /> Plinger</Link>
      <p className={styles.topicSection}>GETTING STARTED</p>
      <Link href="/docs/getting-started/github-account" aria-current={pathname === "/docs/getting-started/github-account" ? "page" : undefined}><UserPlus size={16} aria-hidden="true" /> Create a GitHub account</Link>
      <Link href="/docs/getting-started/drips-wave-account" aria-current={pathname === "/docs/getting-started/drips-wave-account" ? "page" : undefined}><Waves size={16} aria-hidden="true" /> Create a Drips Wave account</Link>
      <Link href="/docs/getting-started/github-pat" aria-current={pathname === "/docs/getting-started/github-pat" ? "page" : undefined}><KeyRound size={16} aria-hidden="true" /> Create your GitHub PAT</Link>
      <Link href="/docs/getting-started/plinger-account" aria-current={pathname === "/docs/getting-started/plinger-account" ? "page" : undefined}><Network size={16} aria-hidden="true" /> Create your Plinger account</Link>
      <p className={styles.topicSection}>WORKING ON ISSUES</p>
      <Link href="/docs/working-on-issues/applying" aria-current={pathname === "/docs/working-on-issues/applying" ? "page" : undefined}><CircleDot size={16} aria-hidden="true" /> Applying for issues</Link>
      <p className={styles.topicSection}>EARNINGS</p>
      <Link href="/docs/withdrawals" aria-current={pathname === "/docs/withdrawals" ? "page" : undefined}><Wallet size={16} aria-hidden="true" /> Withdraw your rewards</Link>
    </nav>
  );
}
