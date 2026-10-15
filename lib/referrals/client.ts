export async function updateReferral(input: object) {
  const response = await fetch("/api/referrals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not update referral");
  return data;
}
