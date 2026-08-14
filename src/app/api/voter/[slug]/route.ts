import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRoundStatuses, getSettings, Round, ROUNDS } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// Everything the voter page needs in one call:
// token validity, round statuses, which rounds this token voted in,
// whether we still need the holder's name, and the ballot entries
// for whichever round is currently open.
export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const slug = params.slug;
  if (!slug || slug.length > 40) {
    return NextResponse.json({ valid: false }, { status: 200 });
  }

  const { data: token, error } = await db()
    .from("tokens")
    .select("id, display_code, holder_name, active")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
  if (!token || !token.active) {
    return NextResponse.json({ valid: false }, { status: 200 });
  }

  const statuses = await getRoundStatuses();
  const branding = await getSettings(["logo_url", "practice_question"]);
  const logoUrl = branding["logo_url"] ?? null;

  // Best-effort: works whether or not the optional phone column exists,
  // so the voting flow can never depend on the v9 migration.
  let hasPhone = true; // default true = don't show the ask if unsure
  try {
    const { data: p, error: pErr } = await db()
      .from("tokens")
      .select("phone")
      .eq("id", token.id)
      .maybeSingle();
    if (!pErr) hasPhone = !!(p as { phone?: string } | null)?.phone;
  } catch {
    /* column may not exist yet — skip the ask */
  }

  const { data: votes } = await db()
    .from("votes")
    .select("round")
    .eq("token_id", token.id);
  const votedRounds = (votes ?? []).map((v) => v.round as Round);

  // Prefer an open round the token hasn't voted in yet, so even if two
  // rounds are ever open simultaneously a voter is never stuck on the
  // receipt while a ballot they could use exists.
  const openRounds = ROUNDS.filter((r) => statuses[r] === "open");
  const openRound =
    openRounds.find((r) => !votedRounds.includes(r)) ?? openRounds[0];

  let entries: { id: number; name: string; photo_url: string | null }[] = [];
  if (openRound && !votedRounds.includes(openRound)) {
    const { data } = await db()
      .from("entries")
      .select("id, name, photo_url")
      .eq("round", openRound)
      .eq("active", true)
      .order("sort", { ascending: true });
    entries = data ?? [];
  }

  return NextResponse.json(
    {
      valid: true,
      display_code: token.display_code,
      needs_name: !token.holder_name,
      statuses,
      voted: votedRounds,
      open_round: openRound ?? null,
      entries,
      logo_url: logoUrl,
      has_phone: hasPhone,
      question: openRound === "practice" ? branding["practice_question"] ?? "" : "",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
