"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, BadgeDollarSign, Check, Clock3, RefreshCw, Users, WalletCards, X } from "lucide-react";
import { useMemo, useState } from "react";
import { adminEarningsQueryKey, getAdminEarnings, updateEarning } from "../../lib/scouter/admin-client";
import type { AdminEarningClaim, EarningsActionInput } from "../../lib/scouter/contracts";
import { formatNaira, formatUsd, splitEarnings } from "../../lib/scouter/money";

export default function EarningsView({ totalScouters }: { totalScouters: number }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const earningsQuery = useQuery({ queryKey: adminEarningsQueryKey, queryFn: getAdminEarnings });
  const mutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: EarningsActionInput }) => updateEarning(id, input),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminEarningsQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["admin", "scouter"] }),
      ]);
      setError("");
      setMessage(variables.input.action === "payout" ? "Payout status updated." : "Earning review updated.");
    },
    onError: (cause) => { setMessage(""); setError(cause instanceof Error ? cause.message : "Could not update earning"); },
  });
  const claims = earningsQuery.data?.claims ?? [];
  const confirmed = claims.filter((claim) => claim.status === "confirmed" && claim.amount_stroops);
  const totals = sumClaims(confirmed);
  const scouters = useMemo(() => aggregateScouters(claims), [claims]);
  const paidScouters = scouters.filter((row) => row.confirmed > BigInt(0) && row.outstanding === BigInt(0)).length;
  const unpaidScouters = scouters.filter((row) => row.outstanding > BigInt(0)).length;
  const busyId = mutation.isPending ? mutation.variables?.id : "";

  if (earningsQuery.isPending) return <div className="earnings-state" role="status"><RefreshCw size={18} className="spinning" /> Loading earnings</div>;
  if (earningsQuery.error) return <div className="earnings-state" role="alert"><strong>Earnings are unavailable</strong><span>{earningsQuery.error instanceof Error ? earningsQuery.error.message : "Try again."}</span><button type="button" className="button button-white" onClick={() => earningsQuery.refetch()}>Retry</button></div>;

  return <section className="earnings-view" aria-labelledby="earnings-overview-heading">
    {(message || error) && <p className={`scouter-notice ${error ? "error" : ""}`} role={error ? "alert" : "status"}>{error || message}</p>}
    <h2 id="earnings-overview-heading" className="sr-only">Earnings overview</h2>
    <div className="earnings-toolbar"><p>Confirmed amounts use a fixed rate of {"\u20a6"}1,400 per USD.</p><button type="button" className="button button-white" disabled={earningsQuery.isFetching} aria-busy={earningsQuery.isFetching} onClick={() => earningsQuery.refetch()}><RefreshCw size={15} className={earningsQuery.isFetching ? "spinning" : ""} aria-hidden="true" /> {earningsQuery.isFetching ? "Refreshing" : "Refresh earnings"}</button></div>
    <div className="earnings-summary" aria-label="Earnings totals">
      <SummaryCard label="Scouters" value={String(totalScouters)} detail={`${scouters.length} with submissions`} icon={Users} />
      <SummaryCard label="Confirmed gross" value={formatUsd(totals.gross)} detail={`${formatNaira(totals.gross)} at \u20a61,400/$`} icon={BadgeDollarSign} />
      <SummaryCard label="Scouter share" value={formatUsd(totals.scouter)} detail={`${formatNaira(totals.scouter)} \u00b7 60%`} icon={WalletCards} tone="green" />
      <SummaryCard label="Plinger share" value={formatUsd(totals.admin)} detail={`${formatNaira(totals.admin)} \u00b7 40%`} icon={BadgeDollarSign} tone="purple" />
      <SummaryCard label="Fully paid" value={String(paidScouters)} detail="No confirmed balance due" icon={Check} tone="green" />
      <SummaryCard label="Awaiting payout" value={String(unpaidScouters)} detail="Confirmed balance outstanding" icon={Clock3} tone="amber" />
    </div>

    <section className="earnings-panel">
      <div className="earnings-panel-heading"><div><p className="overline">60 / 40 SPLIT</p><h2>Scouter balances</h2></div><span>{scouters.length} earning scouter{scouters.length === 1 ? "" : "s"}</span></div>
      {scouters.length ? <div className="earnings-table-wrap"><table className="earnings-table"><thead><tr><th scope="col">Scouter</th><th scope="col">Confirmed gross</th><th scope="col">Scouter 60%</th><th scope="col">Plinger 40%</th><th scope="col">Outstanding</th><th scope="col">Status</th></tr></thead><tbody>{scouters.map((row) => <tr key={row.accountId}><td><strong>{row.login}</strong><small>{row.claims} submission{row.claims === 1 ? "" : "s"}{row.pending > 0n ? ` \u00b7 ${formatUsd(row.pending)} pending` : ""}</small></td><td>{formatUsd(row.confirmed)}<small>{formatNaira(row.confirmed)}</small></td><td>{formatUsd(splitEarnings(row.confirmed).scouter)}<small>{formatNaira(splitEarnings(row.confirmed).scouter)}</small></td><td>{formatUsd(splitEarnings(row.confirmed).admin)}<small>{formatNaira(splitEarnings(row.confirmed).admin)}</small></td><td>{formatUsd(row.outstanding)}<small>{formatNaira(row.outstanding)}</small></td><td><span className={`badge ${row.confirmed === 0n ? "amber" : row.outstanding > 0n ? "red" : "green"}`}>{row.confirmed === 0n ? "Pending review" : row.outstanding > 0n ? "Payout due" : "Paid"}</span></td></tr>)}</tbody></table></div> : <p className="earnings-empty">No earnings have been submitted yet.</p>}
    </section>

    <section className="earnings-panel">
      <div className="earnings-panel-heading"><div><p className="overline">AUDIT QUEUE</p><h2>Withdrawal submissions</h2></div><span>{claims.length} transaction{claims.length === 1 ? "" : "s"}</span></div>
      {claims.length ? <div className="earning-claims">{claims.map((claim) => <ClaimRow key={claim.id} claim={claim} busy={busyId === claim.id} update={(input) => { setError(""); setMessage(""); mutation.mutate({ id: claim.id, input }); }} />)}</div> : <p className="earnings-empty">New verified withdrawals will appear here for review.</p>}
    </section>
  </section>;
}

function SummaryCard({ label, value, detail, icon: Icon, tone = "neutral" }: { label: string; value: string; detail: string; icon: typeof Users; tone?: string }) {
  return <article className={`earnings-summary-card ${tone}`}><span><span>{label}</span><Icon size={18} aria-hidden="true" /></span><strong>{value}</strong><small>{detail}</small></article>;
}

function ClaimRow({ claim, busy, update }: { claim: AdminEarningClaim; busy: boolean; update: (input: EarningsActionInput) => void }) {
  const split = splitEarnings(claim.amount_stroops ?? "0");
  const login = claim.profile?.account_login ?? `GitHub ID ${claim.account_id}`;
  return <article className="earning-claim">
    <div className="earning-claim-main"><span className="earning-avatar" aria-hidden="true">{login.slice(0, 1).toUpperCase()}</span><div><strong>{login}</strong><span>{claim.profile?.bank_name ? `${claim.profile.bank_name} \u00b7 ${claim.profile.bank_account_number}` : "Bank details not added"}</span><span>{formatDate(claim.transaction_created_at ?? claim.created_at)} \u00b7 Ledger {claim.ledger ?? "\u2014"}</span></div></div>
    <div className="earning-claim-money"><strong>{formatUsd(split.gross)}</strong><span>{formatUsd(split.scouter)} scouter \u00b7 {formatUsd(split.admin)} Plinger</span><div className="earning-split" aria-label="60 percent scouter, 40 percent Plinger"><span /><span /></div></div>
    <div className="earning-claim-links"><a href={`https://stellar.expert/explorer/public/tx/${claim.transaction_hash}`} target="_blank" rel="noreferrer">Stellar <ArrowUpRight size={13} aria-hidden="true" /></a><a href={`/api/scouters/${encodeURIComponent(login)}/proofs/${claim.id}`} target="_blank" rel="noreferrer">Proof <ArrowUpRight size={13} aria-hidden="true" /></a></div>
    <div className="earning-claim-status"><span className={`badge ${claim.status === "confirmed" ? "green" : claim.status === "rejected" ? "red" : "amber"}`}>{claim.status}</span>{claim.status === "confirmed" && <span className={`badge ${claim.payout_status === "paid" ? "green" : "neutral"}`}>{claim.payout_status === "paid" ? "Paid" : "Payout due"}</span>}</div>
    <div className="earning-claim-actions" aria-label={`Actions for ${login}'s ${formatUsd(split.gross)} earning`}>
      {claim.status !== "confirmed" && <button type="button" className="button button-white" disabled={busy} onClick={() => update({ action: "review", status: "confirmed" })}><Check size={14} aria-hidden="true" /> Confirm</button>}
      {claim.status !== "rejected" && <button type="button" className="button button-white" disabled={busy} onClick={() => update({ action: "review", status: "rejected" })}><X size={14} aria-hidden="true" /> Reject</button>}
      {claim.status === "confirmed" && <button type="button" className="button button-black" disabled={busy} onClick={() => update({ action: "payout", status: claim.payout_status === "paid" ? "unpaid" : "paid" })}>{claim.payout_status === "paid" ? "Mark unpaid" : "Mark paid"}</button>}
    </div>
  </article>;
}

function aggregateScouters(claims: AdminEarningClaim[]) {
  const rows = new Map<number, { accountId: number; login: string; claims: number; confirmed: bigint; pending: bigint; outstanding: bigint }>();
  for (const claim of claims) {
    const row = rows.get(claim.account_id) ?? { accountId: claim.account_id, login: claim.profile?.account_login ?? String(claim.account_id), claims: 0, confirmed: BigInt(0), pending: BigInt(0), outstanding: BigInt(0) };
    const amount = BigInt(claim.amount_stroops ?? "0");
    row.claims += 1;
    if (claim.status === "confirmed") {
      row.confirmed += amount;
      if (claim.payout_status !== "paid") row.outstanding += splitEarnings(amount).scouter;
    } else if (claim.status === "pending") row.pending += amount;
    rows.set(claim.account_id, row);
  }
  return [...rows.values()].sort((a, b) => a.outstanding === b.outstanding ? a.login.localeCompare(b.login) : a.outstanding > b.outstanding ? -1 : 1);
}

function sumClaims(claims: AdminEarningClaim[]) {
  const gross = claims.reduce((sum, claim) => sum + BigInt(claim.amount_stroops ?? "0"), BigInt(0));
  return splitEarnings(gross);
}

function formatDate(value: string) { return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
