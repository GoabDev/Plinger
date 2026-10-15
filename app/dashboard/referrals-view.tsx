"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminEarningsQueryKey, getAdminEarnings } from "../../lib/scouter/admin-client";
import { formatUsd } from "../../lib/scouter/money";
import styles from "../scouter/referrals.module.css";

type ReferralData = { enabled: boolean; scouters?: { account_id: number | null; account_login: string }[];
  referrals?: { referee_id: number; referrer_id: number; source: string; qualified: boolean; referred_at: string }[] };
async function request(input?: object) {
  const response = await fetch("/api/referrals", input ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) } : { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load referrals");
  return data;
}
export default function ReferralsView() {
  const client = useQueryClient();
  const query = useQuery<ReferralData>({ queryKey: ["admin", "referrals"], queryFn: () => request() });
  const earnings = useQuery({ queryKey: adminEarningsQueryKey, queryFn: getAdminEarnings, enabled: query.data?.enabled === true });
  const [referrer, setReferrer] = useState("");
  const [referee, setReferee] = useState("");
  const [date, setDate] = useState("2026-10-15");
  const [proof, setProof] = useState("");
  const [message, setMessage] = useState("");
  const mutation = useMutation({ mutationFn: request, onSuccess: async () => {
    setMessage("Saved.");
    await Promise.all([client.invalidateQueries({ queryKey: ["admin", "referrals"] }), client.invalidateQueries({ queryKey: adminEarningsQueryKey }), client.invalidateQueries({ queryKey: ["scouter"] })]);
  } });
  if (query.isPending) return <p role="status">Loading referrals…</p>;
  if (query.error) return <p role="alert">{query.error.message} <button className="button button-white" onClick={() => query.refetch()}>Retry</button></p>;
  if (!query.data?.enabled) return <div className={styles.card}><h2>Wave 10 referrals</h2><p>Referral setup is not enabled yet.</p></div>;
  const scouters = query.data.scouters?.filter((s) => s.account_id) ?? [];
  const login = (id: number) => scouters.find((s) => s.account_id === id)?.account_login ?? `GitHub ID ${id}`;
  const confirmed = earnings.data?.claims.filter((p) => p.status === "confirmed") ?? [];
  const selected = confirmed.find((p) => p.id === proof);
  return <div className={styles.layout}>
    <section className={styles.card}><h2>Wave 10 referrals</h2><p>October 15–22, 2026 · Lagos time. One or more qualifying referrals give a scouter 70% of their own Wave 10 earnings.</p><p>A referral qualifies only after a completed withdrawal is confirmed and assigned to Wave 10 below. Proof review can happen after October 22.</p></section>
    {(message || mutation.error) && <p role={mutation.error ? "alert" : "status"}>{mutation.error?.message || message}</p>}
    <section className={styles.card}><h3>Assign a manual referral</h3><p>Record referrals already made during Wave 10. Each referred scouter can have one referrer.</p>
      <form className={styles.form} onSubmit={(event) => { event.preventDefault(); setMessage(""); mutation.mutate({ action: "assign", referrer: Number(referrer), referee: Number(referee), referredAt: new Date(`${date}T00:00:00+01:00`).toISOString() }); }}>
        <label>Referred by<select required value={referrer} onChange={(e) => setReferrer(e.target.value)}><option value="">Select referrer</option>{scouters.map((s) => <option key={s.account_id} value={s.account_id!}>{s.account_login}</option>)}</select></label>
        <label>Referred scouter<select required value={referee} onChange={(e) => setReferee(e.target.value)}><option value="">Select referred scouter</option>{scouters.filter((s) => String(s.account_id) !== referrer).map((s) => <option key={s.account_id} value={s.account_id!}>{s.account_login}</option>)}</select></label>
        <label>Date referred (Lagos)<input required type="date" min="2026-10-15" max="2026-10-22" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <button className="button button-black" disabled={mutation.isPending}>Assign referral</button>
      </form>
    </section>
    <section className={styles.card}><h3>Confirm a withdrawal belongs to Wave 10</h3><p>First review and confirm the proof in Earnings. Then check the withdrawal’s Wave before assigning it here. Do this for both referred scouters and referrers; older earnings must stay unassigned.</p>
      {earnings.error && <p role="alert">Could not load withdrawals. <button onClick={() => earnings.refetch()}>Retry</button></p>}
      <form className={styles.form} onSubmit={(event) => { event.preventDefault(); mutation.mutate({ action: selected?.wave10 ? "untag" : "tag", proofId: proof }); }}>
        <label>Confirmed withdrawal<select required value={proof} onChange={(e) => setProof(e.target.value)}><option value="">Select a withdrawal</option>{confirmed.map((p) => <option key={p.id} value={p.id}>{p.profile?.account_login ?? p.account_id} · {formatUsd(p.amount_stroops ?? 0)} · {new Date(p.created_at).toLocaleDateString()} · {p.id.slice(0, 8)}{p.wave10 ? " · Wave 10" : ""}</option>)}</select></label>
        {selected && <><a className="button button-white" href={`/api/scouters/${encodeURIComponent(selected.profile?.account_login ?? "")}/proofs/${proof}`} target="_blank" rel="noreferrer">Review proof ↗</a><label className={styles.check}><input key={proof} required type="checkbox" />{selected.wave10 ? "I have checked this assignment should be removed." : "I checked the proof and confirm this withdrawal belongs to Wave 10."}</label></>}
        <button className="button button-black" disabled={mutation.isPending || !selected}>{selected?.wave10 ? "Remove Wave 10 assignment" : "Confirm Wave 10"}</button>
      </form>
    </section>
    <section className={styles.card}><h3>All referrals ({query.data.referrals?.length ?? 0})</h3><div className={styles.tableWrap}><table className="earnings-table"><thead><tr><th>Referrer</th><th>Referred scouter</th><th>Source</th><th>Status</th><th>Correction</th></tr></thead><tbody>{query.data.referrals?.map((r) => <tr key={r.referee_id}><td>{login(r.referrer_id)}</td><td>{login(r.referee_id)}</td><td>{r.source}</td><td><span className={`badge ${r.qualified ? "green" : "amber"}`}>{r.qualified ? "Qualified · Wave 10" : "Awaiting Wave 10 proof"}</span></td><td><button className="button button-white" disabled={mutation.isPending} onClick={() => { if (window.confirm("Remove this referral? This is only allowed before it supports a recorded bonus.")) mutation.mutate({ action: "remove", referee: r.referee_id }); }}>Remove</button></td></tr>)}</tbody></table></div>{!query.data.referrals?.length && <p>No referrals recorded yet.</p>}</section>
  </div>;
}
