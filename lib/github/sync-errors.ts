// Return actionable messages without echoing arbitrary database or credential errors.
// Full exception details remain in the server logs.
export function describeSyncError(error: unknown): string {
  const value = error && typeof error === "object" ? error as { code?: unknown; message?: unknown; cause?: unknown } : null;
  const code = typeof value?.code === "string" ? value.code : "";
  const message = typeof value?.message === "string" ? value.message : "";
  if (["PGRST204", "PGRST205", "42703", "42P01"].includes(code)) {
    return "Sync database schema is missing a required table or column. Apply the Plinger Supabase migrations and reload its schema cache.";
  }
  if (["PGRST301", "PGRST302", "PGRST303", "42501"].includes(code) || message === "Invalid API key") {
    return "Sync database access was denied. Check SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) for the configured Supabase project.";
  }
  if (code && /^(?:PGRST\d{3}|[0-9A-Z]{5})$/.test(code)) {
    return `Sync database request failed (${code}). Check the Vercel runtime logs.`;
  }
  if (message === "Supabase service is not configured") {
    return "Sync database is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in Vercel.";
  }
  if (message === "Scouter has no saved GitHub PAT") {
    return "This Scouter has no saved GitHub PAT. Save a PAT in the Scouter portal before syncing.";
  }
  if (message === "PAT encryption key must be 32 bytes in base64") {
    return "Saved GitHub tokens cannot be read. Set PLINGER_PAT_ENCRYPTION_KEY to the original 32-byte base64 encryption key.";
  }
  if (message === "Invalid PAT ciphertext" || message === "Unsupported state or unable to authenticate data") {
    return "Saved GitHub token could not be decrypted. Restore the original PLINGER_PAT_ENCRYPTION_KEY or re-save the Scouter PAT.";
  }
  if (/^GitHub token validation failed: 401$/.test(message)) {
    return "Saved GitHub token is invalid or expired. Re-save a valid PAT for this Scouter.";
  }
  if (/^GitHub (?:token validation failed|assigned issue search|authored pull request search|repository details|Scouter work GraphQL):? (?:403|429)$/.test(message)) {
    return "GitHub denied the sync request or rate-limited it. Check the Scouter PAT permissions and GitHub rate limits.";
  }
  if (/^GitHub token belongs to @/.test(message)) {
    return "Saved GitHub token belongs to a different account. Re-save this Scouter's own PAT.";
  }
  if (message === "fetch failed" || (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name))) {
    return "Sync could not reach GitHub or Supabase. Retry and check the Vercel runtime logs if it continues.";
  }
  if (value?.cause && value.cause !== error) return describeSyncError(value.cause);
  return "Scouter work sync failed. Check the Vercel runtime logs for the underlying error.";
}
