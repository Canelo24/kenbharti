// npm run loadtest
// Acceptance check §7.8: fires 1,000 votes in 60 seconds + 200 concurrent
// state polls against the deployed site, then verifies ZERO duplicate
// (token_id, round) rows in the database.
//
// Run this against a TEST round: open a round in /admin first.
// Needs .env.local with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// NEXT_PUBLIC_BASE_URL.
//
// NOTE: it votes with real tokens. Use it BEFORE the event, then clean up:
//   delete from votes;  update tokens set holder_name = null;

import { createClient } from "@supabase/supabase-js";
import { loadEnv, need } from "./env.mjs";

loadEnv();
const supabase = createClient(
  need("SUPABASE_URL"),
  need("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } }
);
const baseUrl = need("NEXT_PUBLIC_BASE_URL").replace(/\/$/, "");

const TOTAL_VOTES = 1000;
const WINDOW_MS = 60_000;
const POLLERS = 200;

let voteOk = 0;
let voteAlready = 0;
let voteErr = 0;
let pollOk = 0;
let pollErr = 0;

async function main() {
  // Which round is open?
  const state = await (await fetch(`${baseUrl}/api/state`)).json();
  const round = state.rangoli === "open" ? "rangoli" : state.dance === "open" ? "dance" : null;
  if (!round) {
    console.error("No round is open. Open a round in /admin first, then rerun.");
    process.exit(1);
  }
  console.log(`Testing round: ${round}`);

  const { data: entries } = await supabase
    .from("entries")
    .select("id")
    .eq("round", round)
    .eq("active", true);
  if (!entries?.length) throw new Error("No active entries for this round");

  const { data: tokens } = await supabase
    .from("tokens")
    .select("slug")
    .eq("active", true)
    .limit(TOTAL_VOTES);
  if (!tokens?.length) throw new Error("No tokens — run npm run generate first");
  console.log(`${tokens.length} tokens available (each fires one vote; ~${Math.round((TOTAL_VOTES / tokens.length) * 100) / 100} rounds of reuse if fewer than ${TOTAL_VOTES}).`);

  const t0 = Date.now();

  // 200 concurrent state pollers for the whole window
  const pollers = Array.from({ length: POLLERS }, async () => {
    while (Date.now() - t0 < WINDOW_MS) {
      try {
        const r = await fetch(`${baseUrl}/api/state`);
        r.ok ? pollOk++ : pollErr++;
      } catch {
        pollErr++;
      }
      await new Promise((res) => setTimeout(res, 2000 + Math.random() * 2000));
    }
  });

  // 1000 votes spread over 60 seconds
  const votes = Array.from({ length: TOTAL_VOTES }, async (_, i) => {
    await new Promise((res) => setTimeout(res, (i / TOTAL_VOTES) * WINDOW_MS));
    const token = tokens[i % tokens.length];
    const entry = entries[Math.floor(Math.random() * entries.length)];
    try {
      const r = await fetch(`${baseUrl}/api/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: token.slug,
          round,
          entry_id: entry.id,
          name: "Load Test",
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.ok) data.already ? voteAlready++ : voteOk++;
      else voteErr++;
    } catch {
      voteErr++;
    }
  });

  await Promise.all([...votes, ...pollers]);

  // Verify: zero duplicate (token_id, round) rows
  const { data: allVotes } = await supabase
    .from("votes")
    .select("token_id, round");
  const seen = new Set();
  let dups = 0;
  for (const v of allVotes ?? []) {
    const k = `${v.token_id}:${v.round}`;
    if (seen.has(k)) dups++;
    seen.add(k);
  }

  console.log("\n===== LOAD TEST RESULT =====");
  console.log(`Votes: ${voteOk} new, ${voteAlready} already-voted, ${voteErr} errors`);
  console.log(`State polls: ${pollOk} ok, ${pollErr} errors`);
  console.log(`Duplicate (token,round) rows in DB: ${dups}`);
  const pass = voteErr === 0 && pollErr === 0 && dups === 0;
  console.log(pass ? "✅ PASS — zero errors, zero duplicates" : "❌ FAIL — see numbers above");
  console.log("\nClean up test votes with SQL:  delete from votes;  update tokens set holder_name = null;");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
