import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSettings, ROUNDS, setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// Kill switch: CLOSE ALL VOTING NOW. Any round that is open -> closed.
export async function POST() {
  const denied = requireAdmin();
  if (denied) return denied;

  // Every round, practice included — otherwise "all voting closed" would
  // be a lie and the still-open round would block opening the next one.
  const s = await getSettings(ROUNDS.map((r) => `${r}_status`));
  for (const r of ROUNDS) {
    if (s[`${r}_status`] === "open") await setSetting(`${r}_status`, "closed");
  }
  return NextResponse.json({ ok: true });
}
