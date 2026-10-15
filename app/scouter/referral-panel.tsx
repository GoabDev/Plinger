"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCopy, Check } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import styles from "./referrals.module.css";

type Data = { enabled: boolean; open?: boolean; code?: string; path?: string; count?: number; qualifiedCount?: number; eligible?: boolean;
  referrals?: { accountId: number; login: string | null; referredAt: string; wave: number; qualified: boolean }[] };
export default function ReferralPanel() {
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState(false);
  const query = useQuery<Data>({ queryKey: ["scouter", "referrals"], queryFn: async () => {
    const response = await fetch("/api/me/referrals", { cache: "no-store" });
    if (!response.ok) throw new Error("Referrals are temporarily unavailable");
    return response.json();
  } });
  async function copy(value: string, kind: string) {
    try { await navigator.clipboard.writeText(value); setCopied(kind); setCopyError(false); } catch { setCopyError(true); }
  }
  if (query.isPending) return <p role="status">Loading your referrals…</p>;
  if (query.error) return <section className={styles.card}><p role="alert">{query.error.message}</p><Button variant="outline" onClick={() => query.refetch()}>Retry</Button></section>;
  if (!query.data.enabled) return <section className={styles.card}><h2>Refer and earn</h2><p>Referrals are not available yet. Check back soon.</p></section>;
  const data = query.data;
  const link = typeof window === "undefined" ? data.path ?? "" : new URL(data.path!, window.location.origin).href;
  return <div className={styles.layout}>
    <div className={styles.stats}><div><span>People referred</span><strong>{data.count ?? 0}</strong></div><div><span>Qualified for Wave 10</span><strong>{data.qualifiedCount ?? 0}</strong></div><div><span>Your Wave 10 share</span><strong>{data.eligible ? "70%" : "60%"}</strong></div></div>
    <div className={styles.shareGrid}><section className={styles.card}><div className={styles.heading}><h2>Your referral link</h2><span className={`badge ${data.open ? "purple" : "neutral"}`}>{data.open ? "Wave 10 · Open" : "Wave 10 · Closed"}</span></div><p>Share this link with a new scouter so their signup is linked to you.</p>
      <div className={styles.link}><Input aria-label="Your referral link" readOnly value={link} onFocus={(e) => e.target.select()} /><Button onClick={() => copy(link, "link")}>{copied === "link" ? <Check size={16} /> : <ClipboardCopy size={16} />}{copied === "link" ? "Copied" : "Copy link"}</Button></div>
      <div className={styles.code}><span>Referral code</span><code>{data.code}</code><Button variant="outline" size="sm" onClick={() => copy(data.code ?? "", "code")}>{copied === "code" ? "Copied" : "Copy code"}</Button></div>
      {copyError && <p role="status">Copying was unavailable. Select and copy the link or code above.</p>}
      {!data.open && <p>New Wave 10 referrals are closed. Existing referrals can still qualify after proof review.</p>}
    </section><section className={styles.card}><h2>How your bonus works</h2><p>Invite a new scouter October 15–22, 2026 (Lagos time). Once an admin confirms their completed Wave 10 withdrawal, your share of your own Wave 10 earnings increases from 60% to 70%.</p><p>One or more qualifying referrals unlock the same 10% bonus. Bonuses do not stack or carry over.</p><span className={`badge ${data.eligible ? "green" : "amber"}`}>{data.eligible ? "+10% unlocked for Wave 10" : "Awaiting a qualifying referral"}</span></section></div>
    <section className={styles.card}><h2>People you referred</h2><p>Follow their qualification status for each wave.</p>{data.referrals?.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Scouter</th><th>Date referred</th><th>Wave</th><th>Status</th></tr></thead><tbody>{data.referrals.map((person) => <tr key={person.accountId}><td><strong>{person.login ?? `GitHub ID ${person.accountId}`}</strong></td><td>{new Date(person.referredAt).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric" })}</td><td>Wave {person.wave}</td><td><span className={`badge ${person.qualified ? "green" : "amber"}`}>{person.qualified ? "Qualified" : "Awaiting proof"}</span></td></tr>)}</tbody></table></div> : <div className={styles.empty}><strong>No referrals yet</strong><span>People who sign up through your link will appear here.</span></div>}<div className={styles.note}>Awaiting proof means their completed Wave 10 withdrawal has not yet been confirmed and assigned to this wave by an admin.</div></section>
  </div>;
}
