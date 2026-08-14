import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings, setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// Clears ONLY practice-round votes so the warm-up quiz can be run again
// with a new question. Scoped to round='practice' — it is incapable of
// touching a real rangoli or dance vote.
export async function POST(req: NextRequest) {
  const denied = requireAdmin();
  if (denied) return denied;

  // { action: 'set_question', question } — save the question text
  // { }  (or anything else)             — clear the practice votes
  let body: { action?: string; question?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* no body = clear */
  }

  if (body.action === "set_question") {
    await setSetting(
      "practice_question",
      String(body.question ?? "").slice(0, 200)
    );
    return NextResponse.json({ ok: true });
  }

  const { error } = await db().from("votes").delete().eq("round", "practice");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Back to locked so the next question starts from a clean state. If a
  // question is still live we leave it open rather than yanking the
  // ballot out from under people mid-vote.
  const current = (await getSettings(["practice_status"]))["practice_status"];
  if (current !== "open") {
    await setSetting("practice_status", "locked");
  }
  return NextResponse.json({ ok: true, still_open: current === "open" });
}
