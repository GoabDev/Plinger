import type { ScouterProfile } from "../dashboard/scouters";
import { responseJson } from "../api/client";
import type { ProofReviewInput } from "./contracts";

export type AdminScouterProfile = ScouterProfile & {
  privateProfile: {
    patUploaded: boolean;
    patUpdatedAt: string | null;
    bankName: string;
    bankAccountName: string;
    bankAccountNumber: string;
    bankUpdatedAt: string | null;
  };
  proofs: Array<{ id: string; filename: string; status: string; created_at: string }>;
};

export const adminScouterQueryKey = (login: string) => ["admin", "scouter", login] as const;

export async function getAdminScouter(login: string) {
  const response = await fetch(`/api/scouters/${encodeURIComponent(login)}`, { cache: "no-store" });
  return responseJson<AdminScouterProfile>(response);
}

export async function revealScouterPat(login: string) {
  const response = await fetch(`/api/scouters/${encodeURIComponent(login)}/pat`, { method: "POST" });
  return responseJson<{ pat: string }>(response);
}

export async function reviewWithdrawalProof(login: string, id: string, input: ProofReviewInput) {
  const response = await fetch(`/api/scouters/${encodeURIComponent(login)}/proofs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return responseJson<{ ok: true }>(response);
}
