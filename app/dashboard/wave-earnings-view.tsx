"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminEarningsQueryKey, getAdminEarnings, updateEarning } from "../../lib/scouter/admin-client";
import type { AdminEarningClaim, EarningsActionInput } from "../../lib/scouter/contracts";
import { formatUsd, formatNaira, formatNairaKobo, formatNairaRate } from "../../lib/scouter/money";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription } from "../ui/alert-dialog";
import { acceptsEarnings, type Wave } from "../../lib/referrals/contracts";

export default function EarningsView({ totalScouters }: { totalScouters: number }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: adminEarningsQueryKey, queryFn: getAdminEarnings });
  const [wave, setWave] = useState("all");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: EarningsActionInput }) => updateEarning(id, input),
    onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: adminEarningsQueryKey }), queryClient.invalidateQueries({ queryKey: ["admin", "scouter"] }), queryClient.invalidateQueries({ queryKey: ["scouter", "portal"] })]); setNotice("Earning updated. Payment history is preserved."); setError(""); },
    onError: (cause) => { setError(cause.message); setNotice(""); },
  });
  if (query.isPending) return <p role="status">Loading earnings…</p>;
  if (!query.data) return <p role="alert">Earnings are unavailable. <button className="button button-white" onClick={() => query.refetch()}>Retry</button></p>;
  const all = query.data.claims;
  const claims = all.filter((c) => wave === "all" || (c.wave_id ?? "legacy") === wave);
  const waves = new Map(all.map((c) => [c.wave_id ?? "legacy", c.wave_name ?? "Legacy earnings"]));
  const confirmed = claims.filter((c) => c.status === "confirmed");
  const sum = (items: AdminEarningClaim[], key: "amount_stroops" | "entitlement_stroops" | "paid_total_stroops" | "paid_total_kobo") => items.reduce((n, c) => n + BigInt(c[key] ?? "0"), 0n);
  const gross = sum(confirmed, "amount_stroops"), share = sum(confirmed, "entitlement_stroops");
  const rate = query.data.exchangeRate;
  const accounts = [...new Set(claims.map((c) => c.account_id))];
  return <div className="earnings-view referral-stack">
    {(notice || error) && <p className={`scouter-notice ${error ? "error" : ""}`} role={error ? "alert" : "status"}>{error || notice}</p>}
    <div className="referral-toolbar"><label>Earning wave<select className="referral-input" value={wave} onChange={(e) => setWave(e.target.value)}><option value="all">All waves</option>{[...waves].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><button className="button button-white" onClick={() => query.refetch()} disabled={query.isFetching}>Refresh earnings</button></div>
    <p className="scouter-consent">Current estimate: {formatNairaRate(rate.rateMicros)}{rate.isFallback ? " (fallback)" : ""}. Each payment retains its own recorded rate. <a href={rate.sourceUrl} target="_blank" rel="noreferrer">Exchange rate source</a></p>
    <div className="earnings-summary">
      {[ ["Scouters", String(totalScouters)], ["Confirmed gross", formatUsd(gross)], ["Scouter share", formatUsd(share)], ["Plinger share", formatUsd(gross - share)], ["Recorded payouts", formatNairaKobo(sum(claims, "paid_total_kobo"))] ].map(([label, value]) => <article className="earnings-summary-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}
    </div>
    <section className="earnings-panel"><div className="earnings-panel-heading"><h2>Scouter balances</h2><span>Split calculated per earning</span></div>
      <div className="earnings-table-wrap"><table className="earnings-table"><thead><tr><th>Scouter</th><th>Gross</th><th>Scouter share</th><th>Plinger share</th><th>Paid</th><th>Outstanding</th></tr></thead><tbody>{accounts.map((id) => {
        const own = claims.filter((c) => c.account_id === id); const accepted = own.filter((c) => c.status === "confirmed");
        const amount = sum(accepted, "amount_stroops"), entitlement = sum(accepted, "entitlement_stroops");
        const due = own.reduce((n, c) => n + (BigInt(c.balance_stroops) > 0n ? BigInt(c.balance_stroops) : 0n), 0n);
        const discrepancy = own.some((c) => BigInt(c.balance_stroops) < 0n);
        return <tr key={id}><td>{own[0].profile?.account_login ?? id}</td><td>{formatUsd(amount)}</td><td>{formatUsd(entitlement)}</td><td>{formatUsd(amount - entitlement)}</td><td>{formatUsd(sum(own, "paid_total_stroops"))}</td><td>{formatUsd(due)}{discrepancy && <small>Overpayment requires review</small>}</td></tr>;
      })}</tbody></table></div>
    </section>
    <section className="earnings-panel"><div className="earnings-panel-heading"><h2>Withdrawal submissions</h2><span>{claims.length} claims</span></div><div className="earning-claims">{claims.map((claim) => <Claim key={claim.id} claim={claim} waves={query.data.waves ?? []} rate={rate.rateMicros} busy={mutation.isPending} save={(input) => mutation.mutateAsync({ id: claim.id, input })} />)}</div>{!claims.length && <p className="earnings-empty">No earnings in this wave.</p>}</section>
  </div>;
}

function Claim({ claim, waves, rate, busy, save }: { claim: AdminEarningClaim; waves: Wave[]; rate: string; busy: boolean; save: (input: EarningsActionInput) => Promise<unknown> }) {
  const [pending, setPending] = useState<EarningsActionInput | null>(null);
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState("");
  const login = claim.profile?.account_login ?? String(claim.account_id);
  const balance = BigInt(claim.balance_stroops);
  const entitlement = BigInt(claim.entitlement_stroops);
  const reversed = new Set(claim.payments.map((p) => p.reversal_of));
  const begin = (action: EarningsActionInput) => { setPending(action); setReason(""); setLocalError(""); };
  return <div className="scouter-band">
    <div className="scouter-band-heading"><h3>@{login} · {claim.wave_name ?? "Legacy earning"}</h3><span className="badge neutral">{claim.status}</span></div>
    <p>{formatUsd(claim.amount_stroops ?? "0")} gross · {claim.share_percent}% to Scouter ({formatUsd(entitlement)}) · {100 - claim.share_percent}% to Plinger</p>
    <p>{formatUsd(claim.paid_total_stroops)} paid · {formatNairaKobo(claim.paid_total_kobo)} recorded{claim.unknown_legacy_naira ? " · some historical naira amounts are unknown" : ""}</p>
    <p>{balance < 0n ? `${formatUsd(-balance)} overpaid — requires explicit correction` : `${formatUsd(balance)} outstanding`}</p>
    <p className="scouter-consent">{claim.profile?.bank_name ? `${claim.profile.bank_name} · ${claim.profile.bank_account_name} · ${claim.profile.bank_account_number}` : "Bank details not added"}</p>
    <div className="referral-toolbar"><a href={`https://stellar.expert/explorer/public/tx/${claim.transaction_hash}`} target="_blank" rel="noreferrer">Stellar transaction ↗</a><a href={`/api/scouters/${encodeURIComponent(login)}/proofs/${claim.id}`} target="_blank" rel="noreferrer">Withdrawal proof ↗</a></div>
    <p className="scouter-consent">Before confirming, verify that the proof belongs to {claim.wave_name ?? "this legacy earning"}. Payment history locks the earning's review status.</p>
    <div className="referral-toolbar">
      {claim.status !== "confirmed" && <button className="button button-white" disabled={busy || Boolean(claim.payments.length)} onClick={() => begin({ action: "review", status: "confirmed" })}>Confirm earning</button>}
      {claim.status !== "rejected" && <button className="button button-white" disabled={busy || Boolean(claim.payments.length)} onClick={() => begin({ action: "review", status: "rejected" })}>Reject</button>}
      {claim.status === "confirmed" && balance > 0n && <button className="button button-black" disabled={busy} onClick={() => begin({ action: "payout", status: "paid", requestId: crypto.randomUUID(), rateMicros: rate, expectedBalance: claim.balance_stroops, expectedPercent: String(claim.share_percent) as "60" | "70" })}>Record {claim.payments.length ? "remaining payout" : "payout"}</button>}
    </div>
    {claim.status !== "confirmed" && !claim.payments.length && <details className="payment-history"><summary>Correct earning wave before approval</summary><form className="scouter-form" onSubmit={async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); try { await save({ action: "wave", waveId: String(data.get("wave")), reason: String(data.get("reason")) }); setLocalError(""); } catch (error) { setLocalError(error instanceof Error ? error.message : "Could not correct wave"); } }}><label>Correct wave<select name="wave" className="referral-input" required defaultValue=""><option value="">Select verified wave</option>{waves.filter((w) => acceptsEarnings(w)).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label>Reason<textarea name="reason" className="referral-input" required minLength={10} maxLength={1000} /></label><button className="button button-white" disabled={busy}>Save wave correction</button>{localError && <p role="alert">{localError}</p>}</form></details>}
    {!!claim.payments.length && <details className="payment-history"><summary>Payment history ({claim.payments.length})</summary>{claim.payments.map((p) => <div key={p.id}><strong>{formatUsd(p.amount_stroops)}</strong> · {p.amount_kobo ? formatNairaKobo(p.amount_kobo) : "Naira not recorded"} · {new Date(p.created_at).toLocaleString()}<p>{p.reason}{reversed.has(p.id) ? " · Reversed" : ""}</p>{!p.reversal_of && !reversed.has(p.id) && <button className="button button-white" disabled={busy} onClick={() => begin({ action: "reverse", paymentId: p.id, requestId: crypto.randomUUID(), reason: "" })}>Record correction</button>}</div>)}</details>}
    <AlertDialog open={Boolean(pending)} onOpenChange={(open) => { if (!open && !busy) setPending(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{pending?.action === "payout" ? "Record completed payment?" : pending?.action === "reverse" ? "Correct this payment record?" : "Update earning review?"}</AlertDialogTitle><AlertDialogDescription>{pending?.action === "payout" ? `Confirm only after sending ${formatNaira(pending.expectedBalance, pending.rateMicros)} (${formatUsd(pending.expectedBalance)}) to ${login}. This records a payment; it does not send money.` : pending?.action === "reverse" ? "This adds a reversal entry and returns the amount to the balance. The original payment remains in history. It does not recover money from the Scouter." : `Set this earning to ${pending?.action === "review" ? pending.status : ""}. Verify the wave and withdrawal evidence first.`}</AlertDialogDescription></AlertDialogHeader>
      {pending?.action === "reverse" && <label>Correction reason<textarea className="referral-input" minLength={10} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} /></label>}
      {localError && <p role="alert">{localError}</p>}
      <div className="referral-toolbar"><button className="button button-white" disabled={busy} onClick={() => setPending(null)}>Cancel</button><button className="button button-black" disabled={busy || (pending?.action === "reverse" && reason.trim().length < 10)} onClick={async () => { if (!pending) return; try { await save(pending.action === "reverse" ? { ...pending, reason } : pending); setPending(null); } catch (error) { setLocalError(error instanceof Error ? error.message : "Could not save"); } }}>Confirm</button></div>
    </AlertDialogContent></AlertDialog>
  </div>;
}
