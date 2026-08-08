// Loads .env.local (or .env) into process.env for the standalone scripts.
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2];
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}

export function need(key) {
  const v = process.env[key];
  if (!v) {
    console.error(`Missing ${key}. Put it in .env.local (see .env.example).`);
    process.exit(1);
  }
  return v;
}
