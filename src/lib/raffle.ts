import { randomInt } from "crypto";
import { db, fetchAllRows } from "./db";
import { getSettings, setSetting } from "./settings";
import { inRanges, parseRanges } from "./ranges";

export type PoolToken = {
  id: string;
  display_code: string;
  holder_name: string | null;
};

// The pool is computed server-side at the moment of each draw:
//  - token is active
//  - pool = 'range': display code inside the admin-set active ranges
//    pool = 'voted': token has cast at least one vote
//  - token is NOT already a pending_claim/claimed winner of any prize
//    (no repeat winners)
export async function computePool(
  excludeTokenIds: Set<string> = new Set()
): Promise<PoolToken[]> {
  const settings = await getSettings(["raffle_pool", "active_ranges"]);
  const poolMode = settings["raffle_pool"] === "voted" ? "voted" : "range";
  const ranges = parseRanges(settings["active_ranges"] ?? "");

  const { data: tokens, error } = await db()
    .from("tokens")
    .select("id, display_code, holder_name")
    .eq("active", true);
  if (error) throw new Error(error.message);

  let candidates = tokens ?? [];

  if (poolMode === "voted") {
    // Paginated: votes can exceed Supabase's 1000-row response cap.
    // REAL rounds only — the warm-up quiz must not qualify anyone for
    // the "you must vote to win" prizes.
    const votes = await fetchAllRows<{ token_id: string; round: string }>(
      "votes",
      "token_id, round"
    );
    const votedIds = new Set(
      votes.filter((v) => v.round !== "practice").map((v) => v.token_id)
    );
    candidates = candidates.filter((t) => votedIds.has(t.id));
  } else {
    candidates = candidates.filter((t) => inRanges(t.display_code, ranges));
  }

  // Exclude anyone who already holds a prize (pending_claim or claimed)
  const { data: winners, error: wErr } = await db()
    .from("draws")
    .select("token_id, status")
    .in("status", ["pending_claim", "claimed"]);
  if (wErr) throw new Error(wErr.message);
  const winnerIds = new Set((winners ?? []).map((w) => w.token_id as string));

  return candidates.filter(
    (t) => !winnerIds.has(t.id) && !excludeTokenIds.has(t.id)
  );
}

export async function drawPrize(
  prizeId: number,
  excludeTokenIds: Set<string> = new Set(),
  expectStatus: "pending" | "drawn" = "pending"
): Promise<{ ok: true; winner: PoolToken } | { ok: false; error: string }> {
  const { data: prize, error: pErr } = await db()
    .from("prizes")
    .select("id, name, status")
    .eq("id", prizeId)
    .maybeSingle();
  if (pErr || !prize) return { ok: false, error: "Prize not found" };
  // Guards against a double-tapped Draw or two admin tabs racing:
  // a prize can only be drawn from the status the caller expects.
  if (prize.status !== expectStatus) {
    return {
      ok: false,
      error: `This prize is already '${prize.status}' — refresh and check before drawing again`,
    };
  }

  const pool = await computePool(excludeTokenIds);
  if (pool.length === 0) {
    return { ok: false, error: "No eligible tokens in the pool" };
  }

  // Crypto-secure randomness — not Math.random()
  const winner = pool[randomInt(pool.length)];

  const { data: draw, error: dErr } = await db()
    .from("draws")
    .insert({ prize_id: prizeId, token_id: winner.id })
    .select("id")
    .single();
  if (dErr || !draw) return { ok: false, error: "Could not record the draw" };

  const { error: uErr } = await db()
    .from("prizes")
    .update({ status: "drawn" })
    .eq("id", prizeId);
  if (uErr) {
    return {
      ok: false,
      error: `Winner recorded but prize status update failed: ${uErr.message}`,
    };
  }

  // Tell the projector what to spin to
  await setSetting(
    "raffle_current",
    JSON.stringify({
      draw_id: draw.id,
      prize_id: prizeId,
      prize_name: prize.name,
      display_code: winner.display_code,
      holder_name: winner.holder_name ?? "",
      at: new Date().toISOString(),
    })
  );

  return { ok: true, winner };
}

// Redraw: mark the previous pending draw 'redrawn', then draw again.
// The redrawn token is excluded from THIS prize's redraw but stays
// eligible for other prizes (it never became a pending/claimed winner).
export async function redrawPrize(prizeId: number) {
  const { data: prev, error } = await db()
    .from("draws")
    .select("id, token_id")
    .eq("prize_id", prizeId)
    .eq("status", "pending_claim");
  if (error) return { ok: false as const, error: error.message };

  const excluded = new Set<string>();
  if (prev && prev.length > 0) {
    await db()
      .from("draws")
      .update({ status: "redrawn" })
      .eq("prize_id", prizeId)
      .eq("status", "pending_claim");
  }

  // Exclude every token previously redrawn for this same prize
  const { data: past } = await db()
    .from("draws")
    .select("token_id")
    .eq("prize_id", prizeId)
    .eq("status", "redrawn");
  for (const d of past ?? []) excluded.add(d.token_id as string);

  // A redraw happens on a prize that is already 'drawn'
  return drawPrize(prizeId, excluded, "drawn");
}
