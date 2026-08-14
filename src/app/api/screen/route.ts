import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dbFingerprint } from "@/lib/fingerprint";
import { getSettings, Round } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// Data feed for the projector (/screen). Public but safe:
//  - while voting is open it exposes ONLY the total count, never per-option
//  - per-entry results appear only after the admin has revealed the round
export async function GET() {
  const s = await getSettings([
    "screen_mode",
    "rangoli_status",
    "dance_status",
    "practice_status",
    "practice_question",
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
    live_practice: "practice",
    results_practice: "practice",
  };
  const round = roundOf[mode];
  const isPractice = round === "practice";
  payload.is_practice = isPractice;
  if (isPractice) payload.question = s["practice_question"] ?? "";

  // select('*') keeps this working whether or not the optional
  // photo_screen_url column (v9 migration) exists yet.
  type EntryRow = {
    id: number;
    name: string;
    photo_url: string | null;
    photo_screen_url?: string | null;
  };
  const bestPhoto = (e: EntryRow) => e.photo_screen_url || e.photo_url || null;

  if (mode === "live_r1" || mode === "live_r2" || mode === "live_practice") {
    const { count } = await db()
      .from("votes")
      .select("id", { count: "exact", head: true })
      .eq("round", round);
    payload.count = count ?? 0;
    payload.round = round;
    // Lets the screen switch its badge to "VOTING CLOSED — counter frozen"
    payload.round_status = s[`${round}_status`] ?? "locked";

    // Gallery for the live view: show the audience what they're voting on.
    // Names + photos only — never vote counts while voting runs.
    // (Practice questions show their options as text, no gallery.)
    if (!isPractice) {
      const { data: galleryRows } = await db()
        .from("entries")
        .select("*")
        .eq("round", round)
        .eq("active", true)
        .order("sort");
      payload.gallery = ((galleryRows ?? []) as EntryRow[]).map((e) => ({
        id: e.id,
        name: e.name,
        photo_url: bestPhoto(e),
      }));
    } else {
      const { data: optionRows } = await db()
        .from("entries")
        .select("id, name")
        .eq("round", "practice")
        .eq("active", true)
        .order("sort");
      payload.options = (optionRows ?? []).map((e) => e.name as string);
    }
  }

  if (
    mode === "results_r1" ||
    mode === "results_r2" ||
    mode === "results_practice"
  ) {
    payload.round = round;
    const status = s[`${round}_status`];
    if (status === "revealed") {
      const { data: entries } = await db()
        .from("entries")
        .select("*")
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
      payload.results = ((entries ?? []) as EntryRow[]).map((e) => ({
        id: e.id,
        name: e.name,
        photo_url: bestPhoto(e),
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
