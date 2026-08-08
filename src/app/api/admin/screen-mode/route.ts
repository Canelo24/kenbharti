import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isScreenMode, setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// The projector never changes unless one of these buttons is pressed.
export async function POST(req: NextRequest) {
  const denied = requireAdmin();
  if (denied) return denied;

  let body: { mode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!body.mode || !isScreenMode(body.mode)) {
    return NextResponse.json({ error: "Bad mode" }, { status: 400 });
  }
  await setSetting("screen_mode", body.mode);
  // Leaving raffle mode clears the last draw so re-entering raffle mode
  // later never auto-replays an old prize's spin.
  if (body.mode !== "raffle") {
    await setSetting("raffle_current", "");
  }
  return NextResponse.json({ ok: true });
}
