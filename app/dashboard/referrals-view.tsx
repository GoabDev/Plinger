"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getReferralEvidence, getReferrals, referralQueryKey, saveReferralData } from "../../lib/referrals/client";
import type { Referral, Wave } from "../../lib/referrals/contracts";
import { responseJson } from "../../lib/api/client";

export default function ReferralsView() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: [...referralQueryKey, "admin"], queryFn: () => getReferrals(true) });
  const [waveId, setWaveId] = useState("");
  const [review, setReview] = useState<Referral | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: ({ path, input }: { path: "waves" | "referrals"; input: unknown }) => saveReferralData(path, input),
    onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: referralQueryKey }), queryClient.invalidateQueries({ queryKey: ["admin", "earnings"] }), queryClient.invalidateQueries({ queryKey: ["scouter", "portal"] })]); setError(""); setMessage("Saved."); setReview(null); },
    onError: (cause) => { setMessage(""); setError(cause.message); },
  });
  if (query.isPending) return <p role="status">Loading waves and referrals…</p>;
  if (!query.data) return <p role="alert">Waves are unavailable. Apply the referral migration before enabling this feature. <button className="button button-white" onClick={() => query.refetch()}>Retry</button></p>;
  const selected = waveId || query.data.activeWave?.id || query.data.waves.find((w) => w.name === "Wave 10")?.id || query.data.waves[0]?.id;
  const wave = query.data.waves.find((w) => w.id === selected);
  const rows = query.data.referrals.filter((r) => r.wave_id === selected);
  return <div className="referral-stack">
    {(message || error) && <p className={`scouter-notice ${error ? "error" : ""}`} role={error ? "alert" : "status"}>{error || message}</p>}
    <div className="referral-toolbar"><label>Wave <select className="referral-input" value={selected} onChange={(e) => { setWaveId(e.target.value); setReview(null); }}>{query.data.waves.map((w) => <option key={w.id} value={w.id}>{w.name} · {w.status}</option>)}</select></label><button className="button button-white" onClick={() => query.refetch()}>Refresh</button></div>
    {wave && <WaveEditor key={`${wave.id}-${wave.status}`} wave={wave} busy={mutation.isPending} save={(input) => mutation.mutate({ path: "waves", input })} />}
    <form className="referral-toolbar" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const name = String(new FormData(form).get("name")); mutation.mutate({ path: "waves", input: { name } }); form.reset(); }}><label>New wave name <input name="name" className="referral-input" required maxLength={80} placeholder="Wave 11" /></label><button className="button button-white" disabled={mutation.isPending}>Create draft</button></form>
    <section className="scouter-band"><div className="scouter-band-heading"><h2>Referral activity review</h2><span>{rows.length} referrals</span></div><p className="scouter-consent">Qualify only after verifying the referred Scouter completed assigned work in this wave. Confirmed earnings support the review; they are not mandatory. One qualification gives the referrer 70/30 across this wave, including any top-up owed on earlier payouts.</p>
      {rows.length ? <div className="earnings-table-wrap"><table className="earnings-table"><thead><tr><th>Referrer</th><th>New Scouter</th><th>Status</th><th>Review</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>@{r.referrer_login}</td><td>@{r.referred_login}</td><td>{r.status}</td><td><button className="button button-white" onClick={() => setReview(r)}>View evidence</button></td></tr>)}</tbody></table></div> : <p>No referrals in this wave.</p>}
    </section>
    {review && <ReviewPanel key={review.id} referral={review} closed={wave?.status === "closed"} busy={mutation.isPending} save={(input) => mutation.mutate({ path: "referrals", input })} />}
    {wave && <AuditHistory subject={review?.id || wave.id} refresh={query.dataUpdatedAt} />}
  </div>;
}

function WaveEditor({ wave, busy, save }: { wave: Wave; busy: boolean; save: (input: unknown) => void }) {
  const draft = wave.status === "draft";
  return <section className="scouter-band"><div className="scouter-band-heading"><h2>{wave.name}</h2><span className="badge neutral">{wave.status}</span></div>
    {draft ? <form className="referral-form-grid" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const value = (key: string) => String(data.get(key) ?? ""); save({ id: wave.id, name: value("name"), status: (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") || "draft", timezone: value("timezone"), starts_at: new Date(value("starts_at")).toISOString(), ends_at: new Date(value("ends_at")).toISOString(), qualification_deadline: new Date(value("qualification_deadline")).toISOString() }); }}>
      <label>Name<input className="referral-input" name="name" defaultValue={wave.name} required maxLength={80} /></label>
      <label>Display timezone<input className="referral-input" name="timezone" defaultValue={wave.timezone} required /></label>
      {(["starts_at", "ends_at", "qualification_deadline"] as const).map((key, i) => <label key={key}>{["Starts", "Ends", "Qualification deadline"][i]}<input className="referral-input" name={key} type="datetime-local" defaultValue={localDate(wave[key])} required /></label>)}
      <p className="scouter-consent">Enter dates in your device timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Activation locks these dates. Only one wave can be active.</p>
      <div className="referral-toolbar"><button className="button button-white" value="draft" disabled={busy}>Save draft</button><button className="button button-black" value="active" disabled={busy}>Activate wave</button></div>
    </form> : <><p>{wave.starts_at ? `${new Date(wave.starts_at).toLocaleString(undefined, { timeZone: wave.timezone })} – ${new Date(wave.ends_at!).toLocaleString(undefined, { timeZone: wave.timezone })} (${wave.timezone})` : "Historical dates not recorded."}</p>{wave.qualification_deadline && <p>Qualification deadline: {new Date(wave.qualification_deadline).toLocaleString(undefined, { timeZone: wave.timezone })}</p>}{wave.status !== "closed" && <button className="button button-black" disabled={busy} onClick={() => save({ ...wave, status: wave.status === "active" ? "settling" : "closed" })}>{wave.status === "active" ? "Stop referrals and begin settlement" : "Close wave and freeze eligibility"}</button>}</>}
    {!draft && wave.status !== "closed" && <details className="payment-history"><summary>Extend tentative dates</summary><form className="scouter-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); save({ ...wave, operation: "extend", ends_at: new Date(String(data.get("ends_at"))).toISOString(), qualification_deadline: new Date(String(data.get("qualification_deadline"))).toISOString() }); }}><p>Dates can be extended, but not shortened or moved into another wave. This change is recorded in the decision history. Enter dates in your device timezone.</p><label>New end<input className="referral-input" type="datetime-local" name="ends_at" defaultValue={localDate(wave.ends_at)} min={localDate(wave.ends_at)} required /></label><label>New review deadline<input className="referral-input" type="datetime-local" name="qualification_deadline" defaultValue={localDate(wave.qualification_deadline)} min={localDate(wave.qualification_deadline)} required /></label><button className="button button-white" disabled={busy}>Extend schedule</button></form></details>}
  </section>;
}
function ReviewPanel({ referral, closed, busy, save }: { referral: Referral; closed: boolean; busy: boolean; save: (input: unknown) => void }) {
  const query = useQuery({ queryKey: [...referralQueryKey, "evidence", referral.id], queryFn: () => getReferralEvidence(referral.id) });
  const [status, setStatus] = useState("qualified");
  return <section className="scouter-band"><h2>Activity for @{referral.referred_login}</h2>{referral.reason && <p>Last review: {referral.reason}</p>}
    {query.isPending ? <p>Loading evidence…</p> : !query.data ? <p role="alert">Could not load activity. <button onClick={() => query.refetch()}>Retry</button></p> : <>
      <p>{query.data.confirmedEarnings} confirmed earnings · {query.data.paidEarnings} with recorded payments in this wave.</p>
      <p>Merged PRs by this Scouter:</p><ul>{query.data.mergedPullRequests.map((pr) => <li key={pr.url}><a href={pr.url} target="_blank" rel="noreferrer">{pr.title}</a></li>)}</ul>
      {!closed && <form className="scouter-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); save({ id: referral.id, status, reason: data.get("reason"), issueId: data.get("issueId") ? Number(data.get("issueId")) : undefined, contributionVerified: data.get("verified") === "on" }); }}>
        <label>Decision<select className="referral-input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="qualified">Qualify</option><option value="rejected">Reject</option><option value="revoked">Revoke previous qualification</option></select></label>
        {status === "qualified" && <><label>Assigned issue completed in this wave<select className="referral-input" name="issueId" required><option value="">Choose verified completed work</option>{query.data.issues.map((i) => <option key={i.github_issue_id} value={i.github_issue_id}>{i.title}</option>)}</select></label><ul>{query.data.issues.map((i) => <li key={i.github_issue_id}><a href={i.url} target="_blank" rel="noreferrer">Review {i.title}</a></li>)}</ul><label><input name="verified" type="checkbox" required /> I verified this Scouter did the work; it was not merely closed or completed by someone else.</label></>}
        <label>Reason and contribution evidence<textarea className="referral-input" name="reason" required minLength={10} maxLength={2000} placeholder="Explain the accepted contribution and link supporting evidence." /></label>
        <p className="scouter-consent">This decision changes the referrer's entire wave entitlement. Existing payments stay recorded; any difference appears in earnings.</p><button className="button button-black" disabled={busy}>Save activity review</button>
      </form>}{closed && <p>This wave is closed; eligibility is frozen.</p>}
    </>}
  </section>;
}
function AuditHistory({ subject, refresh }: { subject: string; refresh: number }) {
  const query = useQuery({ queryKey: [...referralQueryKey, "audit", subject, refresh], queryFn: async () => responseJson<Array<{ id: string; action: string; created_at: string; details: unknown }>>(await fetch(`/api/admin/referrals?audit=${subject}`, { cache: "no-store" })) });
  return <details className="scouter-band"><summary>Decision history</summary>{query.error ? <p>History unavailable.</p> : query.data?.map((entry) => <div key={entry.id}><strong>{entry.action}</strong> · {new Date(entry.created_at).toLocaleString()}<pre className="referral-audit">{JSON.stringify(entry.details, null, 2)}</pre></div>)}</details>;
}
function localDate(value: string | null) { if (!value) return ""; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
