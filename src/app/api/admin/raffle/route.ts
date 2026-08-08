import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { setSetting } from "@/lib/settings";
import { computePool, drawPrize, redrawPrize } from "@/lib/raffle";

export const dynamic = "force-dynamic";

// POST { action, ... }
//   set_pool     { pool: 'range' | 'voted' }
//   set_ranges   { ranges: 'KB-0001-KB-0650' }
//   pool_size    {}                       -> how many tokens are eligible right now
//   draw         { prize_id }
//   redraw       { prize_id }
//   claim        { prize_id }             -> mark prize claimed
//   add_prize    { name, sort }
//   delete_prize { prize_id }             -> only if never drawn
export async function POST(req: NextRequest) {
  const denied = requireAdmin();
  if (denied) return denied;

  let body: {
    action?: string;
    pool?: string;
    ranges?: string;
    prize_id?: number;
    name?: string;
    sort?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  switch (body.action) {
    case "set_pool": {
      const pool = body.pool === "voted" ? "voted" : "range";
      await setSetting("raffle_pool", pool);
      return NextResponse.json({ ok: true });
    }

    case "set_ranges": {
      await setSetting("active_ranges", String(body.ranges ?? "").slice(0, 500));
      return NextResponse.json({ ok: true });
    }

    case "pool_size": {
      const pool = await computePool();
      return NextResponse.json({ ok: true, size: pool.length });
    }

    case "draw": {
      if (!Number.isInteger(body.prize_id)) {
        return NextResponse.json({ error: "Bad prize" }, { status: 400 });
      }
      const result = await drawPrize(body.prize_id as number);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 409 });
      }
      return NextResponse.json({ ok: true, winner: result.winner });
    }

    case "redraw": {
      if (!Number.isInteger(body.prize_id)) {
        return NextResponse.json({ error: "Bad prize" }, { status: 400 });
      }
      const result = await redrawPrize(body.prize_id as number);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 409 });
      }
      return NextResponse.json({ ok: true, winner: result.winner });
    }

    case "claim": {
      if (!Number.isInteger(body.prize_id)) {
        return NextResponse.json({ error: "Bad prize" }, { status: 400 });
      }
      await db()
        .from("draws")
        .update({ status: "claimed" })
        .eq("prize_id", body.prize_id as number)
        .eq("status", "pending_claim");
      await db()
        .from("prizes")
        .update({ status: "claimed" })
        .eq("id", body.prize_id as number);
      return NextResponse.json({ ok: true });
    }

    case "add_prize": {
      const name = String(body.name ?? "").trim();
      if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
      const { error } = await db()
        .from("prizes")
        .insert({ name, sort: Number(body.sort ?? 0) || 0 });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    case "delete_prize": {
      if (!Number.isInteger(body.prize_id)) {
        return NextResponse.json({ error: "Bad prize" }, { status: 400 });
      }
      const { count } = await db()
        .from("draws")
        .select("id", { count: "exact", head: true })
        .eq("prize_id", body.prize_id as number);
      if ((count ?? 0) > 0) {
        return NextResponse.json(
          { error: "This prize has already been drawn — it cannot be deleted" },
          { status: 409 }
        );
      }
      const { error } = await db()
        .from("prizes")
        .delete()
        .eq("id", body.prize_id as number);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
