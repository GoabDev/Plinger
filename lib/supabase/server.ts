type SupabaseWriteResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
};

type SupabaseSelectResult<T> = {
  data: T[];
  skipped?: boolean;
  error?: string;
};

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && getSupabaseSecretKey());
}

export async function selectSupabaseRows<T>({
  table,
  query,
}: {
  table: string;
  query?: Record<string, string>;
}): Promise<SupabaseSelectResult<T>> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = getSupabaseSecretKey();

  if (!supabaseUrl || !secretKey) {
    return { data: [], skipped: true };
  }

  const url = new URL(`/rest/v1/${table}`, supabaseUrl);

  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey: secretKey,
      authorization: `Bearer ${secretKey}`,
      accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      data: [],
      error: await response.text(),
    };
  }

  return {
    data: (await response.json()) as T[],
  };
}

export async function insertSupabaseRow({
  table,
  row,
  onConflict,
}: {
  table: string;
  row: Record<string, unknown>;
  onConflict?: string;
}): Promise<SupabaseWriteResult> {
  return writeSupabaseRow({
    table,
    row,
    onConflict,
    duplicateStrategy: "ignore",
  });
}

export async function upsertSupabaseRow({
  table,
  row,
  onConflict,
}: {
  table: string;
  row: Record<string, unknown>;
  onConflict: string;
}): Promise<SupabaseWriteResult> {
  return writeSupabaseRow({
    table,
    row,
    onConflict,
    duplicateStrategy: "merge",
  });
}

async function writeSupabaseRow({
  table,
  row,
  onConflict,
  duplicateStrategy,
}: {
  table: string;
  row: Record<string, unknown>;
  onConflict?: string;
  duplicateStrategy: "ignore" | "merge";
}): Promise<SupabaseWriteResult> {
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
        ? `resolution=${duplicateStrategy}-duplicates,return=minimal`
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
