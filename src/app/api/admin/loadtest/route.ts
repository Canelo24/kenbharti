import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db, fetchAllRows } from "@/lib/db";
import { getRoundStatuses, Round } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 60;

// One-button event-scale stress test (spec §7.8), runnable by a
// non-technical operator from the admin panel:
//  - fires hundreds of REAL votes through the public /api/vote endpoint
//    with high concurrency (harsher than 800 humans over minutes)
//  - hammers /api/state like a hall full of polling phones
//  - verifies ZERO duplicate (token, round) rows in the database
//  - deletes the test votes it created, leaving the system clean
// Guarded so it cannot run mid-event.

const VOTE_COUNT = 800;
const POLL_COUNT = 400;
const CONCURRENCY = 40;

async function pool<T>(
  items: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await items[i]();
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker)
  );
  return results;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.floor((p / 100) * sorted.length)
  );
  return Math.round(sorted[idx]);
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin();
  if (denied) return denied;

  const base =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    req.nextUrl.origin;
  const startedAt = Date.now();
  const startISO = new Date().toISOString();

  // ---- Preconditions -------------------------------------------------
  const statuses = await getRoundStatuses();
  const openRound = (["rangoli", "dance"] as Round[]).find(
    (r) => statuses[r] === "open"
  );
  if (!openRound) {
    return NextResponse.json(
      { error: "Open a round first — the test votes like real guests do." },
      { status: 409 }
    );
  }

  // Practice/warm-up votes don't count as "real votes already stored"
  const { count: existingVotes } = await db()
    .from("votes")
    .select("id", { count: "exact", head: true })
    .neq("round", "practice");
  if ((existingVotes ?? 0) > 100) {
    return NextResponse.json(
      {
        error:
          "There are already many real votes stored — refusing to run so nothing gets mixed up. This test is for BEFORE the event (run the reset first).",
      },
      { status: 409 }
    );
  }

  const { data: entries } = await db()
    .from("entries")
    .select("id")
    .eq("round", openRound)
    .eq("active", true);
  if (!entries || entries.length === 0) {
    return NextResponse.json(
      { error: `No active entries in the ${openRound} round` },
      { status: 409 }
    );
  }

  const tokens = await fetchAllRows<{ slug: string; active: boolean }>(
    "tokens",
    "slug, active"
  );
  const slugs = tokens
    .filter((t) => t.active && !t.slug.startsWith("__healthcheck__"))
    .map((t) => t.slug)
    .slice(0, VOTE_COUNT);
  if (slugs.length < 50) {
    return NextResponse.json(
      { error: "Generate the 850 tokens first (Tokens section)." },
      { status: 409 }
    );
  }

  // ---- Fire ----------------------------------------------------------
  let voteOk = 0;
  let voteAlready = 0;
  let voteFailed = 0;
  const latencies: number[] = [];

  const voteJobs = slugs.map((slug) => async () => {
    const entry = entries[Math.floor(Math.random() * entries.length)];
    const t0 = Date.now();
    try {
      const res = await fetch(`${base}/api/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, round: openRound, entry_id: entry.id }),
        cache: "no-store",
      });
      latencies.push(Date.now() - t0);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        if (data.already) voteAlready++;
        else voteOk++;
      } else {
        voteFailed++;
      }
    } catch {
      latencies.push(Date.now() - t0);
      voteFailed++;
    }
  });

  let pollOk = 0;
  let pollFailed = 0;
  let pollCached = 0;
  const pollJobs = Array.from({ length: POLL_COUNT }, () => async () => {
    try {
      const res = await fetch(`${base}/api/state`, { cache: "no-store" });
      if (res.ok) {
        pollOk++;
        const cacheHeader = res.headers.get("x-vercel-cache") ?? "";
        if (cacheHeader === "HIT" || cacheHeader === "STALE") pollCached++;
      } else {
        pollFailed++;
      }
    } catch {
      pollFailed++;
    }
  });

  // Votes and phone-style polling at the same time, like the real night
  await Promise.all([
    pool(voteJobs, CONCURRENCY),
    pool(pollJobs, CONCURRENCY),
  ]);

  // ---- Verify integrity ----------------------------------------------
  const allVotes = await fetchAllRows<{ token_id: string; round: string }>(
    "votes",
    "token_id, round"
  );
  const seen = new Set<string>();
  let duplicates = 0;
  for (const v of allVotes) {
    const k = `${v.token_id}:${v.round}`;
    if (seen.has(k)) duplicates++;
    seen.add(k);
  }
  const storedForRound = allVotes.filter((v) => v.round === openRound).length;

  // ---- Clean up the test votes ----------------------------------------
  const { error: cleanErr } = await db()
    .from("votes")
    .delete()
    .eq("round", openRound)
    .gte("created_at", startISO);

  latencies.sort((a, b) => a - b);
  const seconds = Math.round((Date.now() - startedAt) / 100) / 10;
  const pass = voteFailed === 0 && pollFailed === 0 && duplicates === 0;

  return NextResponse.json({
    pass,
    seconds,
    round: openRound,
    votes: {
      sent: slugs.length,
      saved: voteOk,
      already: voteAlready,
      failed: voteFailed,
    },
    polls: { sent: POLL_COUNT, ok: pollOk, failed: pollFailed, cached: pollCached },
    duplicates,
    stored_matched: storedForRound >= voteOk,
    latency_ms: {
      typical: percentile(latencies, 50),
      slow: percentile(latencies, 95),
      worst: latencies[latencies.length - 1] ?? 0,
    },
    cleaned: !cleanErr,
  });
}
