import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Check = {
  name: string;
  ok: boolean;
  detail: string;
  fix?: string;
};

const REQUIRED_SETTINGS = [
  "rangoli_status",
  "dance_status",
  "screen_mode",
  "raffle_pool",
  "active_ranges",
];

const REPAIR_FIX =
  "Run the repair script: Supabase → SQL Editor → paste supabase/repair.sql → Run.";

// Full system self-diagnosis. Every symptom ("votes not counting",
// "screen not changing") shows up here as a precise ❌ with its fix.
export async function GET() {
  const denied = requireAdmin();
  if (denied) return denied;

  const checks: Check[] = [];

  // 1. Environment variables
  for (const key of [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ADMIN_PASSWORD",
    "NEXT_PUBLIC_BASE_URL",
  ]) {
    const present = !!process.env[key];
    checks.push({
      name: `Setting: ${key}`,
      ok: present,
      detail: present ? "set" : "MISSING",
      fix: present
        ? undefined
        : "Add it in Vercel → Settings → Environment Variables, then Redeploy.",
    });
  }

  // 2. Every table must exist and be readable (row counts included)
  for (const table of ["tokens", "entries", "votes", "settings", "prizes", "draws"]) {
    try {
      const { count, error } = await db()
        .from(table)
        .select("*", { count: "exact", head: true });
      if (error) {
        checks.push({
          name: `Table: ${table}`,
          ok: false,
          detail: error.message,
          fix: REPAIR_FIX,
        });
      } else {
        checks.push({
          name: `Table: ${table}`,
          ok: true,
          detail: `${count ?? 0} rows`,
        });
      }
    } catch (e) {
      checks.push({
        name: `Table: ${table}`,
        ok: false,
        detail: e instanceof Error ? e.message : "unreachable",
        fix: REPAIR_FIX,
      });
    }
  }

  // 3. Required settings keys
  try {
    const { data } = await db().from("settings").select("key");
    const have = new Set((data ?? []).map((r) => r.key as string));
    const missing = REQUIRED_SETTINGS.filter((k) => !have.has(k));
    checks.push({
      name: "Settings keys",
      ok: missing.length === 0,
      detail:
        missing.length === 0 ? "all present" : `missing: ${missing.join(", ")}`,
      fix: missing.length === 0 ? undefined : REPAIR_FIX,
    });
  } catch {
    /* covered by table check above */
  }

  // 4. One-vote-per-round protection — proven live with a real duplicate
  //    insert against a throwaway token, then cleaned up.
  try {
    const probeSlug = `__healthcheck__`;
    const { data: entry } = await db()
      .from("entries")
      .select("id, round")
      .limit(1)
      .maybeSingle();
    if (entry) {
      const { data: probe } = await db()
        .from("tokens")
        .upsert(
          { slug: probeSlug, display_code: "KB-TEST", active: false },
          { onConflict: "slug" }
        )
        .select("id")
        .single();
      if (probe) {
        await db().from("votes").delete().eq("token_id", probe.id);
        const first = await db()
          .from("votes")
          .insert({ token_id: probe.id, round: entry.round, entry_id: entry.id });
        const second = await db()
          .from("votes")
          .insert({ token_id: probe.id, round: entry.round, entry_id: entry.id });
        const guarded = !first.error && second.error?.code === "23505";
        await db().from("votes").delete().eq("token_id", probe.id);
        checks.push({
          name: "Double-vote protection",
          ok: guarded,
          detail: guarded
            ? "verified: second vote was rejected by the database"
            : `NOT WORKING (first: ${first.error?.message ?? "ok"}, second: ${second.error?.code ?? "accepted"})`,
          fix: guarded ? undefined : REPAIR_FIX,
        });
      }
    }
  } catch (e) {
    checks.push({
      name: "Double-vote protection",
      ok: false,
      detail: e instanceof Error ? e.message : "check failed",
      fix: REPAIR_FIX,
    });
  }

  // 5. Photo storage bucket
  try {
    const { data, error } = await db().storage.getBucket("photos");
    checks.push({
      name: "Photo storage bucket",
      ok: !!data && !error,
      detail: data ? "exists" : (error?.message ?? "missing"),
      fix: data
        ? undefined
        : "It will be auto-created on the first photo upload — or run the repair script.",
    });
  } catch {
    checks.push({
      name: "Photo storage bucket",
      ok: false,
      detail: "could not check",
    });
  }

  const allOk = checks.every((c) => c.ok);
  return NextResponse.json(
    { ok: allOk, checks },
    { headers: { "Cache-Control": "no-store" } }
  );
}
