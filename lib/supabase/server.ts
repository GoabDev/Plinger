type SupabaseInsertResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
};

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && getSupabaseSecretKey());
}

export async function insertSupabaseRow({
  table,
  row,
  onConflict,
}: {
  table: string;
  row: Record<string, unknown>;
  onConflict?: string;
}): Promise<SupabaseInsertResult> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = getSupabaseSecretKey();

  if (!supabaseUrl || !secretKey) {
    return { ok: true, skipped: true };
  }

  const url = new URL(`/rest/v1/${table}`, supabaseUrl);

  if (onConflict) {
    url.searchParams.set("on_conflict", onConflict);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: secretKey,
      authorization: `Bearer ${secretKey}`,
      "content-type": "application/json",
      prefer: onConflict
        ? "resolution=ignore-duplicates,return=minimal"
        : "return=minimal",
    },
    body: JSON.stringify(row),
  });

  if (!response.ok) {
    return {
      ok: false,
      error: await response.text(),
    };
  }

  return { ok: true };
}

function getSupabaseSecretKey() {
  return (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    null
  );
}
