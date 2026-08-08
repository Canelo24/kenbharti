import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSettings, setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Kill switch: CLOSE ALL VOTING NOW. Any round that is open -> closed.
export async function POST() {
  const denied = requireAdmin();
  if (denied) return denied;

  const s = await getSettings(["rangoli_status", "dance_status"]);
  if (s["rangoli_status"] === "open") await setSetting("rangoli_status", "closed");
  if (s["dance_status"] === "open") await setSetting("dance_status", "closed");
  return NextResponse.json({ ok: true });
}
