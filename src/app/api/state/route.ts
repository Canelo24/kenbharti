import { NextResponse } from "next/server";
import { getRoundStatuses } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// Public, tiny, CDN-cached. 800 polling phones hit the Vercel CDN,
// not the database (s-maxage=5 + stale-while-revalidate=10).
export async function GET() {
  try {
    const statuses = await getRoundStatuses();
    return NextResponse.json(statuses, {
      headers: {
        "Cache-Control": "s-maxage=5, stale-while-revalidate=10",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { rangoli: "locked", dance: "locked", practice: "locked" },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
