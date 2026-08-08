import { db } from "./db";

export type RoundStatus = "locked" | "open" | "closed" | "revealed";
export type Round = "rangoli" | "dance";

export const ROUNDS: Round[] = ["rangoli", "dance"];

export const SCREEN_MODES = [
  "idle",
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
  const s = await getSettings(["rangoli_status", "dance_status"]);
  return {
    rangoli: (s["rangoli_status"] ?? "locked") as RoundStatus,
    dance: (s["dance_status"] ?? "locked") as RoundStatus,
  };
}

export function isRound(v: string): v is Round {
  return v === "rangoli" || v === "dance";
}

export function isScreenMode(v: string): v is ScreenMode {
  return (SCREEN_MODES as readonly string[]).includes(v);
}
