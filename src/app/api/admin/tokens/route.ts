import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { makeTokenRecords } from "@/lib/tokengen.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET ?q=0347  -> search tokens by display code (partial ok)
export async function GET(req: NextRequest) {
  const denied = requireAdmin();
  if (denied) return denied;

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  let query = db()
    .from("tokens")
    .select("id, display_code, holder_name, is_reserve, active")
    .order("display_code")
    .limit(30);
  if (q) query = query.ilike("display_code", `%${q}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count } = await db()
    .from("tokens")
    .select("id", { count: "exact", head: true })
    .not("display_code", "like", "KB-TEST%"); // ignore health-check probes
  return NextResponse.json({ tokens: data ?? [], total: count ?? 0 });
}

// POST { action: 'void' | 'activate', id }
//      { action: 'generate' }  -> creates the 850 tokens (only if none exist)
export async function POST(req: NextRequest) {
  const denied = requireAdmin();
  if (denied) return denied;

  let body: { action?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (body.action === "void" || body.action === "activate") {
    if (!body.id) return NextResponse.json({ error: "Bad id" }, { status: 400 });
    const { error } = await db()
      .from("tokens")
      .update({ active: body.action === "activate" })
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "generate") {
    const { count } = await db()
      .from("tokens")
      .select("id", { count: "exact", head: true })
      .not("display_code", "like", "KB-TEST%"); // ignore health-check probes
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: `Tokens already exist (${count}). Generation only runs once.` },
        { status: 409 }
      );
    }
    const records = makeTokenRecords(800, 50);
    // Insert in batches of 200 to stay well within limits
    for (let i = 0; i < records.length; i += 200) {
      const { error } = await db()
        .from("tokens")
        .insert(records.slice(i, i + 200));
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    return NextResponse.json({ ok: true, created: records.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
