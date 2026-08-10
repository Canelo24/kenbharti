import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// Optional phone capture AFTER a vote is safely stored. Completely
// separate from the voting path — if this endpoint ever failed, voting
// would be unaffected.
export async function POST(req: NextRequest) {
  let body: { slug?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const slug = body.slug ?? "";
  const phone = (body.phone ?? "").trim();
  const digits = phone.replace(/[^\d]/g, "");
  if (!slug || digits.length < 7 || digits.length > 15) {
    return NextResponse.json(
      { error: "That doesn't look like a phone number — check and try again" },
      { status: 400 }
    );
  }

  const { data: token } = await db()
    .from("tokens")
    .select("id, active")
    .eq("slug", slug)
    .maybeSingle();
  if (!token || !token.active) {
    return NextResponse.json({ error: "Invalid code" }, { status: 403 });
  }

  const { error } = await db()
    .from("tokens")
    .update({ phone: phone.slice(0, 25) })
    .eq("id", token.id);
  if (error) {
    return NextResponse.json(
      { error: "Could not save right now — try again in a moment" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
