import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSettings, isRound, setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Round state machine: locked -> open -> closed -> revealed.
// Admin moves forward only; "reopen" exists but the UI shows a
// confirm warning first. Nothing here ever auto-advances.
const ALLOWED: Record<string, { from: string[]; to: string }> = {
  open: { from: ["locked"], to: "open" },
  close: { from: ["open"], to: "closed" },
  reveal: { from: ["closed"], to: "revealed" },
  reopen: { from: ["closed", "revealed"], to: "open" },
};

export async function POST(req: NextRequest) {
  const denied = requireAdmin();
  if (denied) return denied;

  let body: { round?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const { round, action } = body;
  if (!round || !isRound(round) || !action || !ALLOWED[action]) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const key = `${round}_status`;
  const current = (await getSettings([key]))[key] ?? "locked";
  const rule = ALLOWED[action];
  if (!rule.from.includes(current)) {
    return NextResponse.json(
      { error: `Cannot ${action}: round is currently '${current}'` },
      { status: 409 }
    );
  }

  await setSetting(key, rule.to);

  // "Reveal on screen" also points the projector at the results.
  if (action === "reveal") {
    await setSetting(
      "screen_mode",
      round === "rangoli" ? "results_r1" : "results_r2"
    );
  }

  return NextResponse.json({ ok: true, status: rule.to });
}
