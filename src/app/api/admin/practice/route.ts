import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// Clears ONLY practice-round votes so the warm-up quiz can be run again
// with a new question. Scoped to round='practice' — it is incapable of
// touching a real rangoli or dance vote.
export async function POST() {
  const denied = requireAdmin();
  if (denied) return denied;

  const { error } = await db().from("votes").delete().eq("round", "practice");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Back to locked so the next question starts from a clean state.
  await setSetting("practice_status", "locked");
  return NextResponse.json({ ok: true });
}
