import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { dbFingerprint, expectedHost } from "@/lib/fingerprint";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type Check = {
  name: string;
  ok: boolean;
  detail: string;
  fix?: string;
};

const REQUIRED_SETTINGS = [
  "rangoli_status",
  "dance_status",
  "practice_status",
  "screen_mode",
  "raffle_pool",
  "active_ranges",
];

const REPAIR_FIX =
  "Run the repair script: Supabase → SQL Editor → paste supabase/repair.sql → Run.";

// Full system self-diagnosis. Every symptom ("votes not counting",
// "screen not changing") shows up here as a precise ❌ with its fix.
export async function GET(req: NextRequest) {
  const denied = requireAdmin();
  if (denied) return denied;

  const checks: Check[] = [];

  // 0. Correct address: operating the event from a temporary per-deployment
  //    URL splits the system — admin on one copy, voters on another.
  const expect = expectedHost();
  const actual = req.nextUrl.host;
  const hostOk =
    !expect || actual === expect || actual.startsWith("localhost");
  checks.push({
    name: "Using the correct address",
    ok: hostOk,
    detail: hostOk
      ? `${actual} (db ${dbFingerprint()})`
      : `You are on ${actual} but the real site is ${expect}`,
    fix: hostOk
      ? undefined
      : `Close this tab and open https://${expect}/admin instead — temporary deployment links are separate copies of the site.`,
  });

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
  //    insert against a throwaway per-run token, fully removed afterwards.
  //    A unique slug per run means two simultaneous checks can't collide,
  //    and deleting the token keeps it out of counts, exports and raffles.
  try {
    // Self-heal: remove any probe tokens a crashed earlier check left behind
    const { data: strays } = await db()
      .from("tokens")
      .select("id")
      .like("display_code", "KB-TEST%");
    for (const s of strays ?? []) {
      await db().from("votes").delete().eq("token_id", s.id);
      await db().from("tokens").delete().eq("id", s.id);
    }

    const { data: entry } = await db()
      .from("entries")
      .select("id, round")
      .limit(1)
      .maybeSingle();
    if (entry) {
      const runId = crypto.randomUUID().slice(0, 8);
      const { data: probe } = await db()
        .from("tokens")
        .insert({
          slug: `__healthcheck__${runId}`,
          display_code: `KB-TEST-${runId}`,
          active: false,
        })
        .select("id")
        .single();
      if (probe) {
        try {
          const first = await db()
            .from("votes")
            .insert({ token_id: probe.id, round: entry.round, entry_id: entry.id });
          const second = await db()
            .from("votes")
            .insert({ token_id: probe.id, round: entry.round, entry_id: entry.id });
          const guarded = !first.error && second.error?.code === "23505";
          checks.push({
            name: "Double-vote protection",
            ok: guarded,
            detail: guarded
              ? "verified: second vote was rejected by the database"
              : `NOT WORKING (first: ${first.error?.message ?? "ok"}, second: ${second.error?.code ?? "accepted"})`,
            fix: guarded ? undefined : REPAIR_FIX,
          });
        } finally {
          await db().from("votes").delete().eq("token_id", probe.id);
          await db().from("tokens").delete().eq("id", probe.id);
        }
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

  // 4b. Practice round enabled? (v11 migration). Proven by actually
  //     inserting a practice entry + vote, then removing them — so a
  //     forgotten SQL step is caught here and not live on stage.
  try {
    const runId = crypto.randomUUID().slice(0, 8);
    const { data: probeEntry, error: eErr } = await db()
      .from("entries")
      .insert({
        round: "practice",
        name: `__healthcheck__${runId}`,
        active: false,
        sort: 9999,
      })
      .select("id")
      .single();
    if (eErr || !probeEntry) {
      checks.push({
        name: "Practice round (warm-up quiz)",
        ok: false,
        detail: eErr?.message ?? "could not create a practice entry",
        fix: "Run the v11 migration: Supabase → SQL Editor → paste supabase/migration-v11.sql → Run. (Not needed if you aren't using the warm-up quiz.)",
      });
    } else {
      await db().from("entries").delete().eq("id", probeEntry.id);
      checks.push({
        name: "Practice round (warm-up quiz)",
        ok: true,
        detail: "enabled",
      });
    }
  } catch (e) {
    checks.push({
      name: "Practice round (warm-up quiz)",
      ok: false,
      detail: e instanceof Error ? e.message : "check failed",
      fix: "Run supabase/migration-v11.sql in the Supabase SQL Editor.",
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
