import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSettings, isRound, ROUNDS, setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

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
  const others = ROUNDS.filter((r) => r !== round);
  const settings = await getSettings([key, ...others.map((r) => `${r}_status`)]);
  const current = settings[key] ?? "locked";
  const rule = ALLOWED[action];
  if (!rule.from.includes(current)) {
    return NextResponse.json(
      { error: `Cannot ${action}: round is currently '${current}'` },
      { status: 409 }
    );
  }

  // Only one round may ever be open at a time — otherwise voters get a
  // second ballot straight after the first and it looks like double voting.
  if (action === "open" || action === "reopen") {
    const alreadyOpen = others.find(
      (r) => (settings[`${r}_status`] ?? "locked") === "open"
    );
    if (alreadyOpen) {
      return NextResponse.json(
        {
          error: `Close the ${alreadyOpen} round first — only one round can be open at a time`,
        },
        { status: 409 }
      );
    }
  }

  await setSetting(key, rule.to);

  // "Reveal on screen" also points the projector at the results.
  if (action === "reveal") {
    const mode =
      round === "rangoli"
        ? "results_r1"
        : round === "dance"
          ? "results_r2"
          : "results_practice";
    await setSetting("screen_mode", mode);
  }

  return NextResponse.json({ ok: true, status: rule.to });
}
