import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dbFingerprint } from "@/lib/fingerprint";
import { getSettings, Round } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Data feed for the projector (/screen). Public but safe:
//  - while voting is open it exposes ONLY the total count, never per-option
//  - per-entry results appear only after the admin has revealed the round
export async function GET() {
  const s = await getSettings([
    "screen_mode",
    "rangoli_status",
    "dance_status",
    "raffle_current",
    "logo_url",
  ]);
  const mode = s["screen_mode"] ?? "idle";

  const payload: Record<string, unknown> = {
    mode,
    logo_url: s["logo_url"] ?? null,
    fp: dbFingerprint(),
  };

  const roundOf: Record<string, Round> = {
    live_r1: "rangoli",
    results_r1: "rangoli",
    live_r2: "dance",
    results_r2: "dance",
  };
  const round = roundOf[mode];

  if (mode === "live_r1" || mode === "live_r2") {
    const { count } = await db()
      .from("votes")
      .select("id", { count: "exact", head: true })
      .eq("round", round);
    payload.count = count ?? 0;
    payload.round = round;
    // Lets the screen switch its badge to "VOTING CLOSED — counter frozen"
    payload.round_status = s[`${round}_status`] ?? "locked";
  }

  if (mode === "results_r1" || mode === "results_r2") {
    payload.round = round;
    const status = s[`${round}_status`];
    if (status === "revealed") {
      const { data: entries } = await db()
        .from("entries")
        .select("id, name, photo_url, sort")
        .eq("round", round)
        .eq("active", true)
        .order("sort");
      const { data: votes } = await db()
        .from("votes")
        .select("entry_id")
        .eq("round", round);
      const counts = new Map<number, number>();
      for (const v of votes ?? []) {
        counts.set(v.entry_id, (counts.get(v.entry_id) ?? 0) + 1);
      }
      payload.results = (entries ?? []).map((e) => ({
        id: e.id,
        name: e.name,
        photo_url: e.photo_url,
        votes: counts.get(e.id) ?? 0,
      }));
    } else {
      // Reveal not pressed yet — show nothing per-option
      payload.results = null;
    }
  }

  if (mode === "raffle") {
    const raw = s["raffle_current"];
    if (raw) {
      try {
        payload.raffle = JSON.parse(raw);
      } catch {
        payload.raffle = null;
      }
    } else {
      payload.raffle = null;
    }
  }

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
