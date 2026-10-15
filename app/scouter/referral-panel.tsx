"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCopy, Check } from "lucide-react";
import styles from "./referrals.module.css";

type Data = { enabled: boolean; open?: boolean; path?: string; count?: number; qualifiedCount?: number; eligible?: boolean };
export default function ReferralPanel() {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const query = useQuery<Data>({ queryKey: ["scouter", "referrals"], queryFn: async () => {
    const response = await fetch("/api/me/referrals", { cache: "no-store" });
    if (!response.ok) throw new Error("Referral links are temporarily unavailable");
    return response.json();
  } });
  if (query.isPending) return null;
  if (query.error) return <div className={styles.card}><p role="alert">{query.error.message}</p><button className="button button-white" onClick={() => query.refetch()}>Retry</button></div>;
  if (!query.data.enabled) return null;
  const link = typeof window === "undefined" ? query.data.path : new URL(query.data.path!, window.location.origin).href;
  return <section className={styles.card} aria-labelledby="referrals-heading"><div className={styles.heading}><h2 id="referrals-heading">Refer and earn</h2><span className={`badge ${query.data.eligible ? "green" : "purple"}`}>{query.data.eligible ? "Wave 10 · +10% unlocked" : "Wave 10"}</span></div>
    <p>Invite a new scouter by October 22, 2026 (Lagos time). When their completed Wave 10 withdrawal is confirmed by an admin, your share of your own Wave 10 earnings increases from 60% to 70%.</p>
    <p>One or more qualifying referrals unlock the same 10% bonus. Bonuses do not stack or carry over.</p>
    {query.data.open ? <div className={styles.link}><input aria-label="Your referral link" readOnly value={link} onFocus={(e) => e.target.select()} /><button className="button button-black" onClick={async () => { try { await navigator.clipboard.writeText(link!); setCopied(true); setCopyError(false); } catch { setCopyError(true); } }}>{copied ? <Check size={16} /> : <ClipboardCopy size={16} />}{copied ? "Copied" : "Copy link"}</button></div> : <p>Wave 10 referrals are closed. Existing referrals can still qualify after proof review.</p>}
    <p role="status">{copyError ? "Select and copy the link above." : `${query.data.count} referred · ${query.data.qualifiedCount} qualified`}</p>
  </section>;
}
