import type { BankDetailsInput, GithubPatInput, ScouterPortalData } from "./contracts";
import { responseJson } from "../api/client";

export const scouterPortalQueryKey = ["scouter", "portal"] as const;

export async function getScouterPortal() {
  const response = await fetch("/api/me/scouter", { cache: "no-store" });
  return responseJson<ScouterPortalData>(response);
}

export async function updateScouterProfile(input: GithubPatInput | BankDetailsInput) {
  const response = await fetch("/api/me/scouter", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return responseJson<{ ok: true }>(response);
}

export async function uploadWithdrawalProof(file: File) {
  const form = new FormData();
  form.append("proof", file);
  const response = await fetch("/api/me/scouter/proofs", { method: "POST", body: form });
  return responseJson<{ ok: true }>(response);
}
