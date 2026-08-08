import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client using the service-role key.
// RLS is deny-all, so this client is the ONLY way in or out of the database.
let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable"
      );
    }
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

// Supabase caps responses at 1000 rows. With 800 voters x 2 rounds the
// votes table can hold 1600 rows, so every full-table read MUST paginate
// or tallies/turnout/raffle pools silently truncate.
export async function fetchAllRows<T>(
  table: string,
  columns: string
): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db()
      .from(table)
      .select(columns)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    all.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return all;
}
