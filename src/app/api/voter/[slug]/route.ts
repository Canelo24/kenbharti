import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRoundStatuses, getSettings, Round } from "@/lib/settings";

export const dynamic = "force-dynamic";

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
  const logoUrl = (await getSettings(["logo_url"]))["logo_url"] ?? null;

  const { data: votes } = await db()
    .from("votes")
    .select("round")
    .eq("token_id", token.id);
  const votedRounds = (votes ?? []).map((v) => v.round as Round);

  // Only one round can sensibly be open at a time; pick the open one
  // the token hasn't voted in yet.
  const openRound = (["rangoli", "dance"] as Round[]).find(
    (r) => statuses[r] === "open"
  );

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
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
