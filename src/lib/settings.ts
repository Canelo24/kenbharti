import { db } from "./db";

export type RoundStatus = "locked" | "open" | "closed" | "revealed";
// 'practice' is the optional audience warm-up quiz. It behaves like a
// round but never counts as a real competition result, and its votes can
// be cleared and re-run. The two real rounds are unaffected by it.
export type Round = "rangoli" | "dance" | "practice";
export type RealRound = "rangoli" | "dance";

// Real rounds first: if two rounds were ever open at once, a voter must
// be handed the REAL ballot, never the warm-up quiz.
export const ROUNDS: Round[] = ["rangoli", "dance", "practice"];
export const REAL_ROUNDS: RealRound[] = ["rangoli", "dance"];

export const SCREEN_MODES = [
  "idle",
  "live_practice",
  "results_practice",
  "live_r1",
  "results_r1",
  "live_r2",
  "results_r2",
  "raffle",
] as const;
export type ScreenMode = (typeof SCREEN_MODES)[number];

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const { data, error } = await db()
    .from("settings")
    .select("key,value")
    .in("key", keys);
  if (error) throw new Error(error.message);
  const out: Record<string, string> = {};
  for (const row of data ?? []) out[row.key] = row.value;
  return out;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const { error } = await db()
    .from("settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function getRoundStatuses(): Promise<Record<Round, RoundStatus>> {
  const s = await getSettings([
    "rangoli_status",
    "dance_status",
    "practice_status",
  ]);
  return {
    rangoli: (s["rangoli_status"] ?? "locked") as RoundStatus,
    dance: (s["dance_status"] ?? "locked") as RoundStatus,
    practice: (s["practice_status"] ?? "locked") as RoundStatus,
  };
}

export function isRound(v: string): v is Round {
  return v === "rangoli" || v === "dance" || v === "practice";
}

export function isScreenMode(v: string): v is ScreenMode {
  return (SCREEN_MODES as readonly string[]).includes(v);
}
