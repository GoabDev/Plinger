"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AdminEarningClaim } from "../../lib/scouter/contracts";
import { adminEarningsQueryKey } from "../../lib/scouter/admin-client";
import { updateReferral } from "../../lib/referrals/client";
import { formatUsd } from "../../lib/scouter/money";
import { Button } from "../ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../ui/alert-dialog";

export default function ReferralProofAction({ claim, busy }: { claim: AdminEarningClaim; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const mutation = useMutation({ mutationFn: () => updateReferral({ action: claim.wave10 ? "untag" : "tag", proofId: claim.id }), onSuccess: async () => {
    setOpen(false);
    await Promise.all([client.invalidateQueries({ queryKey: adminEarningsQueryKey }), client.invalidateQueries({ queryKey: ["admin", "referrals"] }), client.invalidateQueries({ queryKey: ["scouter"] })]);
  } });
  if (claim.wave10 === undefined || claim.status !== "confirmed") return null;
  if (claim.wave10 && (claim.payout_status === "paid" || BigInt(claim.bonusPaidStroops ?? "0") > 0n)) return <span className="badge green">Wave 10 confirmed</span>;
  const login = claim.profile?.account_login ?? `GitHub ID ${claim.account_id}`;
  return <AlertDialog open={open} onOpenChange={(value) => { if (!mutation.isPending) { setOpen(value); mutation.reset(); } }}>
    <AlertDialogTrigger asChild><Button variant="outline" size="sm" className="button button-white" disabled={busy}>{claim.wave10 ? "Remove Wave 10" : "Confirm referral"}</Button></AlertDialogTrigger>
    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{claim.wave10 ? "Remove Wave 10 assignment?" : "Confirm this withdrawal belongs to Wave 10?"}</AlertDialogTitle><AlertDialogDescription>{claim.wave10
      ? `Remove the Wave 10 assignment for ${login}'s ${formatUsd(claim.amount_stroops ?? "0")} withdrawal. This may remove referral eligibility. Assignments supporting a recorded bonus cannot be removed.`
      : `Confirm you reviewed ${login}'s ${formatUsd(claim.amount_stroops ?? "0")} completed withdrawal and verified it belongs to Wave 10. This confirms their participation for their referrer, if they have one, and assigns these earnings to Wave 10. Older withdrawals must stay unassigned.`}</AlertDialogDescription></AlertDialogHeader>
      <a className="text-sm underline" href={`/api/scouters/${encodeURIComponent(claim.profile?.account_login ?? "")}/proofs/${claim.id}`} target="_blank" rel="noreferrer">Review withdrawal proof</a>
      {mutation.error && <p role="alert">{mutation.error.message}</p>}
      <AlertDialogFooter><AlertDialogCancel className="button button-white" disabled={mutation.isPending}>Cancel</AlertDialogCancel><AlertDialogAction className="button button-black" disabled={mutation.isPending} onClick={(e) => { e.preventDefault(); mutation.mutate(); }}>{mutation.isPending ? "Saving…" : claim.wave10 ? "Remove assignment" : "Confirm Wave 10"}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
