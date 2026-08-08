import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRoundStatuses, isRound } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Casts a vote. Idempotent: a double-tap or two-device race hits the
// UNIQUE (token_id, round) constraint and returns the calm
// "already voted" receipt — never an error page.
export async function POST(req: NextRequest) {
  let body: { slug?: string; round?: string; entry_id?: number; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { slug, round, entry_id } = body;
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";

  if (!slug || !round || !isRound(round) || !Number.isInteger(entry_id)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // 1. Token must exist and be active
  const { data: token, error: tokenErr } = await db()
    .from("tokens")
    .select("id, holder_name, active")
    .eq("slug", slug)
    .maybeSingle();
  if (tokenErr) return NextResponse.json({ error: "server" }, { status: 500 });
  if (!token || !token.active) {
    return NextResponse.json({ error: "Invalid code" }, { status: 403 });
  }

  // 2. Round must be OPEN (a direct POST to a locked/closed round is rejected)
  const statuses = await getRoundStatuses();
  if (statuses[round] !== "open") {
    return NextResponse.json(
      { error: "Voting is not open for this round" },
      { status: 409 }
    );
  }

  // 3. Entry must belong to this round and be active
  const { data: entry } = await db()
    .from("entries")
    .select("id")
    .eq("id", entry_id as number)
    .eq("round", round)
    .eq("active", true)
    .maybeSingle();
  if (!entry) {
    return NextResponse.json({ error: "Invalid entry" }, { status: 400 });
  }

  // 4. Save holder name on first vote (for the raffle display)
  if (!token.holder_name && name) {
    await db().from("tokens").update({ holder_name: name }).eq("id", token.id);
  }

  // 5. Insert the vote. The DB constraint is the one-vote-per-round law.
  const { error: insertErr } = await db().from("votes").insert({
    token_id: token.id,
    round,
    entry_id,
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      // unique_violation: this token already voted this round
      return NextResponse.json({ ok: true, already: true });
    }
    // Surface the real reason — a silent failure here once made votes
    // vanish invisibly. Never again.
    return NextResponse.json(
      { error: `Vote could not be saved (${insertErr.message}). Please show this to the help desk.` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, already: false });
}
