// Browser-only harness: production Server Actions are covered by route tests.
export async function signInWithGitHub() {}
export async function checkReferral(value: string) {
  return value.includes("valid-code") ? { code: "valid-code", login: "referrer", waveName: "Wave 10", waveId: "wave10" } : { error: "Enter a valid Plinger referral link." };
}
