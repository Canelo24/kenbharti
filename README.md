# Kenbharti "Maa Tujhe Salaam" — Live Voting & Raffle

Live audience voting (Rangoli + Dance rounds) and raffle draws for the
Maa Tujhe Salaam awards ceremony, Nairobi (700–800 attendees).

**👉 Non-technical organizers: read [`SETUP_GUIDE.md`](./SETUP_GUIDE.md) —
it walks through everything click by click.**

## Stack

Next.js 14 (App Router) on Vercel · Supabase (Postgres + Storage) ·
Tailwind · framer-motion.

## Pages

| Route | Purpose |
|---|---|
| `/v/[slug]` | Voter page — opened by scanning a QR card. Ballot / receipt / waiting screens driven purely by round state. |
| `/screen` | Projector display — idle branding, live vote counter, animated results reveal, raffle slot machine. |
| `/admin` | Password-protected control room — rounds, screen control, entries CRUD (photos auto-compressed to WebP ≤ 60KB), raffle, tokens, kill switch. |
| `/api/state` | Tiny public state JSON, CDN-cached (`s-maxage=5, stale-while-revalidate=10`) so 800 polling phones never hit the DB. |

## Integrity model

- **One vote per round per token** is a database `UNIQUE (token_id, round)`
  constraint. The API treats a unique violation as an idempotent success
  ("already voted" receipt), so double-taps and two-device races produce
  exactly one row.
- RLS is **deny-all**; every read/write goes through Next.js server routes
  using the service-role key. The service key never reaches a browser.
- Votes are final: no edit, no undo.
- Every state change (open/close/reveal/draw) is an explicit admin button
  press. Nothing auto-advances.
- Raffle winners are picked with `crypto.randomInt` from a pool computed at
  the moment of the draw; pending/claimed winners are excluded, so there
  are no repeat winners. Redraw marks the old draw `redrawn` and excludes
  that token from the same prize's redraw only.

## Realtime budget

Voter phones **never** open Realtime/websocket connections. They poll the
CDN-cached `/api/state` every 10s while waiting and stop once the token has
voted in both rounds. `/screen` and `/admin` poll their server feeds every
2.5s / 5s — the Supabase free-tier connection cap is untouched.

## Environment variables

| Var | Notes |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only, never `NEXT_PUBLIC` |
| `ADMIN_PASSWORD` | shared admin password, also signs the session cookie |
| `NEXT_PUBLIC_BASE_URL` | public site URL — baked into QR codes |

## Setup (technical quick path)

```bash
npm install
# Run supabase/schema.sql in the Supabase SQL editor (tables + RLS + seed)
cp .env.example .env.local   # fill in values
npm run dev
```

## Scripts

- `npm run generate` — creates 850 tokens (800 main KB-0001–KB-0800 +
  50 inactive reserve KB-0801–KB-0850, 10-char base58 slugs), writes
  `tokens.csv` and `qr-cards.pdf` (A4, 8 cards/page). The same generator is
  available as buttons in `/admin` → Tokens, so no local machine is needed.
- `npm run loadtest` — acceptance check §7.8: 1,000 votes over 60s + 200
  concurrent state pollers against the deployed site, then verifies zero
  duplicate `(token, round)` rows. Run against a test round; clean-up SQL
  is printed at the end and listed in `SETUP_GUIDE.md` Part 6.

## Acceptance checklist (spec §7)

1. Double vote → second attempt gets the receipt; one row in `votes`
   (unique constraint + idempotent 23505 handling in `/api/vote`).
2. Two-device race → exactly one row (same constraint; DB is the referee).
3. Locked/closed round → ballot not rendered and direct POST rejected with
   409 (`/api/vote` re-checks status server-side on every request).
4. Reveal only changes the projector when pressed (`screen_mode` is set
   explicitly; `/api/screen` returns per-entry results only when the round
   status is `revealed`).
5. No repeat winners (pool excludes `pending_claim`/`claimed`); redraw
   excludes the redrawn token from that prize only.
6. Reserve activation / card voiding take effect immediately (checked on
   every voter request and every draw).
7. `/api/state` sends `Cache-Control: s-maxage=5, stale-while-revalidate=10`.
8. Load test script included (`npm run loadtest`).
