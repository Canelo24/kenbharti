import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildCsv, buildQrPdf } from "@/lib/tokengen.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function baseUrl(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    req.nextUrl.origin
  );
}

// GET ?format=csv  -> tokens.csv (code, slug, full URL)
// GET ?format=pdf  -> qr-cards.pdf (A4, 8 cards per page)
// GET ?format=pdf&from=1&to=120 -> just cards KB-0001..KB-0120 (test pages)
export async function GET(req: NextRequest) {
  const denied = requireAdmin();
  if (denied) return denied;

  const { data: tokens, error } = await db()
    .from("tokens")
    .select("display_code, slug, is_reserve")
    .not("display_code", "like", "KB-TEST%") // ignore health-check probes
    .order("display_code");
  if (error || !tokens || tokens.length === 0) {
    return NextResponse.json(
      { error: "No tokens yet — press Generate first" },
      { status: 404 }
    );
  }

  const format = req.nextUrl.searchParams.get("format") ?? "csv";
  const base = baseUrl(req);

  if (format === "csv") {
    return new NextResponse(buildCsv(tokens, base), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="tokens.csv"',
      },
    });
  }

  if (format === "pdf") {
    const from = Number(req.nextUrl.searchParams.get("from") ?? 1);
    const to = Number(req.nextUrl.searchParams.get("to") ?? tokens.length);
    const slice = tokens.filter((t) => {
      const n = parseInt(t.display_code.replace(/\D/g, ""), 10);
      return n >= from && n <= to;
    });
    const bytes = await buildQrPdf(slice, base);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="qr-cards-${from}-${to}.pdf"`,
      },
    });
  }

  return NextResponse.json({ error: "Unknown format" }, { status: 400 });
}
