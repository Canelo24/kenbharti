import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db, fetchAllRows } from "@/lib/db";
import { buildCsv, buildQrPdf } from "@/lib/tokengen.mjs";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
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

  // Community contact list: card, name (captured at first vote), phone
  // (left voluntarily on the receipt screen). select('*') keeps this
  // working whether or not the v9 phone column exists.
  if (format === "contacts") {
    const { data: rows } = await db()
      .from("tokens")
      .select("*")
      .not("display_code", "like", "KB-TEST%")
      .order("display_code");
    const lines = ["display_code,name,phone"];
    for (const t of (rows ?? []) as {
      display_code: string;
      holder_name?: string | null;
      phone?: string | null;
    }[]) {
      if (!t.holder_name && !t.phone) continue;
      const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
      lines.push(
        `${t.display_code},${esc(t.holder_name ?? "")},${esc(t.phone ?? "")}`
      );
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="contacts.csv"',
      },
    });
  }

  // Full audit trail for participant verification: card -> name -> phone
  // -> what they voted for in each round, with timestamps. This is the
  // dispute-resolution record ("look, this card voted for X at 19:42").
  if (format === "audit") {
    const { data: tokenRows } = await db()
      .from("tokens")
      .select("*")
      .not("display_code", "like", "KB-TEST%");
    const tokenById = new Map(
      ((tokenRows ?? []) as {
        id: string;
        display_code: string;
        holder_name?: string | null;
        phone?: string | null;
      }[]).map((t) => [t.id, t])
    );
    const { data: entryRows } = await db().from("entries").select("id, name");
    const entryName = new Map(
      (entryRows ?? []).map((e) => [e.id as number, e.name as string])
    );
    const votes = await fetchAllRows<{
      token_id: string;
      round: string;
      entry_id: number;
      created_at: string;
    }>("votes", "token_id, round, entry_id, created_at");

    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = ["display_code,name,phone,round,voted_for,voted_at"];
    const sortedVotes = [...votes].sort((a, b) => {
      const ta = tokenById.get(a.token_id)?.display_code ?? "";
      const tb = tokenById.get(b.token_id)?.display_code ?? "";
      return ta.localeCompare(tb) || a.round.localeCompare(b.round);
    });
    for (const v of sortedVotes) {
      const t = tokenById.get(v.token_id);
      if (!t) continue;
      lines.push(
        [
          t.display_code,
          esc(t.holder_name ?? ""),
          esc(t.phone ?? ""),
          v.round,
          esc(entryName.get(v.entry_id) ?? `entry #${v.entry_id}`),
          v.created_at,
        ].join(",")
      );
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="vote-audit.csv"',
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
