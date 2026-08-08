// npm run generate
// Creates 850 tokens in Supabase (800 main + 50 reserve), then writes
// tokens.csv and qr-cards.pdf into the project folder.
// Needs .env.local with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// NEXT_PUBLIC_BASE_URL.

import { writeFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { loadEnv, need } from "./env.mjs";
import {
  makeTokenRecords,
  buildCsv,
  buildQrPdf,
} from "../src/lib/tokengen.mjs";

loadEnv();
const supabase = createClient(
  need("SUPABASE_URL"),
  need("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } }
);
const baseUrl = need("NEXT_PUBLIC_BASE_URL").replace(/\/$/, "");

async function main() {
  const { count, error: cErr } = await supabase
    .from("tokens")
    .select("id", { count: "exact", head: true });
  if (cErr) throw new Error(cErr.message);

  let tokens;
  if ((count ?? 0) > 0) {
    console.log(`Tokens already exist (${count}) — re-exporting CSV + PDF only.`);
    const { data, error } = await supabase
      .from("tokens")
      .select("display_code, slug, is_reserve")
      .order("display_code");
    if (error) throw new Error(error.message);
    tokens = data;
  } else {
    console.log("Generating 850 tokens (800 main + 50 reserve)…");
    tokens = makeTokenRecords(800, 50);
    for (let i = 0; i < tokens.length; i += 200) {
      const { error } = await supabase
        .from("tokens")
        .insert(tokens.slice(i, i + 200));
      if (error) throw new Error(error.message);
      console.log(`  inserted ${Math.min(i + 200, tokens.length)} / ${tokens.length}`);
    }
  }

  writeFileSync("tokens.csv", buildCsv(tokens, baseUrl));
  console.log("Wrote tokens.csv");

  console.log("Building qr-cards.pdf (this takes ~a minute)…");
  const pdf = await buildQrPdf(tokens, baseUrl);
  writeFileSync("qr-cards.pdf", Buffer.from(pdf));
  console.log("Wrote qr-cards.pdf — print ONE page and test-scan with 3 phones first!");
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
