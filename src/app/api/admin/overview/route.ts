import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db, fetchAllRows } from "@/lib/db";
import { dbFingerprint } from "@/lib/fingerprint";
import { getSettings, Round, ROUNDS } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Everything the admin dashboard shows, in one call (polled every 5s).
export async function GET() {
  const denied = requireAdmin();
  if (denied) return denied;

  try {
    return await buildOverview();
  } catch (e) {
    // Surface the real reason (bad SUPABASE_URL, bad key, …) so the
    // admin page can display it instead of loading forever.
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: `Cannot reach the database: ${msg}` },
      { status: 500 }
    );
  }
}

async function buildOverview() {
  const settings = await getSettings([
    "rangoli_status",
    "dance_status",
    "screen_mode",
    "raffle_pool",
    "active_ranges",
    "raffle_current",
    "logo_url",
  ]);

  // Per-option tallies (admin-only while voting runs)
  const { data: entries } = await db()
    .from("entries")
    .select("id, round, name, photo_url, sort, active")
    .order("sort");
  // Paginated: the votes table can exceed Supabase's 1000-row response cap
  const votes = await fetchAllRows<{
    round: Round;
    entry_id: number;
    token_id: string;
  }>("votes", "round, entry_id, token_id");

  const tallies: Record<Round, { entry_id: number; votes: number }[]> = {
    rangoli: [],
    dance: [],
  };
  const counts = new Map<string, number>();
  for (const v of votes ?? []) {
    const k = `${v.round}:${v.entry_id}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  for (const r of ROUNDS) {
    tallies[r] = (entries ?? [])
      .filter((e) => e.round === r)
      .map((e) => ({ entry_id: e.id, votes: counts.get(`${r}:${e.id}`) ?? 0 }));
  }

  // Turnout: distinct tokens that voted vs active tokens
  const votedTokens = new Set((votes ?? []).map((v) => v.token_id as string));
  const { count: activeTokens } = await db()
    .from("tokens")
    .select("id", { count: "exact", head: true })
    .eq("active", true);
  const { count: totalTokens } = await db()
    .from("tokens")
    .select("id", { count: "exact", head: true });

  // Prizes with their current winner (if any)
  const { data: prizes } = await db()
    .from("prizes")
    .select("id, name, sort, status")
    .order("sort");
  const { data: draws } = await db()
    .from("draws")
    .select("id, prize_id, token_id, status, drawn_at")
    .order("id", { ascending: false });
  const tokenIds = Array.from(
    new Set((draws ?? []).map((d) => d.token_id as string))
  );
  let drawTokens: { id: string; display_code: string; holder_name: string | null }[] = [];
  if (tokenIds.length > 0) {
    const { data } = await db()
      .from("tokens")
      .select("id, display_code, holder_name")
      .in("id", tokenIds);
    drawTokens = data ?? [];
  }
  const tokenById = new Map(drawTokens.map((t) => [t.id, t]));
  const prizeList = (prizes ?? []).map((p) => {
    const current = (draws ?? []).find(
      (d) => d.prize_id === p.id && d.status !== "redrawn"
    );
    const t = current ? tokenById.get(current.token_id as string) : null;
    return {
      ...p,
      winner: t
        ? {
            display_code: t.display_code,
            holder_name: t.holder_name,
            draw_status: current!.status,
          }
        : null,
    };
  });

  return NextResponse.json(
    {
      settings,
      fp: dbFingerprint(),
      entries: entries ?? [],
      tallies,
      turnout: {
        voted: votedTokens.size,
        active: activeTokens ?? 0,
        total: totalTokens ?? 0,
      },
      prizes: prizeList,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
