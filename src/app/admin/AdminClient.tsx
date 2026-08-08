"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Round = "rangoli" | "dance";
type Entry = {
  id: number;
  round: Round;
  name: string;
  photo_url: string | null;
  sort: number;
  active: boolean;
};
type Prize = {
  id: number;
  name: string;
  sort: number;
  status: "pending" | "drawn" | "claimed";
  winner: {
    display_code: string;
    holder_name: string | null;
    draw_status: string;
  } | null;
};
type Overview = {
  settings: Record<string, string>;
  entries: Entry[];
  tallies: Record<Round, { entry_id: number; votes: number }[]>;
  turnout: { voted: number; active: number; total: number };
  prizes: Prize[];
};
type TokenRow = {
  id: string;
  display_code: string;
  holder_name: string | null;
  is_reserve: boolean;
  active: boolean;
};

const ROUND_LABEL: Record<Round, string> = {
  rangoli: "Round 1 — Rangoli",
  dance: "Round 2 — Dance",
};
const STATUS_COLOR: Record<string, string> = {
  locked: "bg-white/15 text-white/70",
  open: "bg-green-600 text-white",
  closed: "bg-yellow-600 text-white",
  revealed: "bg-purple-600 text-white",
};
const SCREEN_BUTTONS: { mode: string; label: string }[] = [
  { mode: "idle", label: "🏠 Idle (branding)" },
  { mode: "live_r1", label: "🎨 Live counter — Rangoli" },
  { mode: "results_r1", label: "🏆 Results — Rangoli" },
  { mode: "live_r2", label: "💃 Live counter — Dance" },
  { mode: "results_r2", label: "🏆 Results — Dance" },
  { mode: "raffle", label: "🎁 Raffle" },
];

export default function AdminClient() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4000);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      if (res.ok) {
        setOv(await res.json());
        setLoadError("");
      } else {
        const data = await res.json().catch(() => ({}));
        setLoadError(data.error ?? `Server error (${res.status})`);
      }
    } catch {
      setLoadError("Network problem — check your internet connection.");
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const post = useCallback(
    async (url: string, body: unknown): Promise<boolean> => {
      setBusy(true);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          showToast(`⚠️ ${data.error ?? "Something went wrong"}`);
          return false;
        }
        await refresh();
        return true;
      } catch {
        showToast("⚠️ Network problem — try again");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refresh, showToast]
  );

  if (!ov) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        {loadError ? (
          <>
            <p className="text-lg font-bold text-red-400">⚠️ {loadError}</p>
            <div className="max-w-md text-sm text-white/60">
              <p>Usually this means one of the Supabase values in Vercel is wrong.</p>
              <p className="mt-2">
                Check <b>SUPABASE_URL</b> (https://….supabase.co) and{" "}
                <b>SUPABASE_SERVICE_ROLE_KEY</b> in Vercel → Settings →
                Environment Variables, then <b>Redeploy</b>.
              </p>
            </div>
            <button className="btn-ghost" onClick={refresh}>
              Try again
            </button>
          </>
        ) : (
          <p className="kb-pulse">Loading control room…</p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-4 pb-24">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-brand-saffron">Control Room</h1>
          <p className="text-sm text-white/60">
            Turnout: {ov.turnout.voted} / {ov.turnout.active} tokens have voted
          </p>
        </div>
        <button
          className="btn-ghost text-sm"
          onClick={async () => {
            await fetch("/api/admin/logout", { method: "POST" });
            window.location.reload();
          }}
        >
          Log out
        </button>
      </header>

      {toast && (
        <div className="fixed inset-x-4 top-4 z-50 rounded-lg bg-black/90 p-3 text-center shadow-lg">
          {toast}
        </div>
      )}

      <RoundsSection ov={ov} post={post} busy={busy} />
      <ScreenSection ov={ov} post={post} busy={busy} />
      <EntriesSection ov={ov} refresh={refresh} showToast={showToast} />
      <RaffleSection ov={ov} post={post} busy={busy} showToast={showToast} />
      <TokensSection showToast={showToast} refresh={refresh} />

      {/* Kill switch */}
      <section className="card mt-6 border-red-500/40">
        <h2 className="mb-2 font-bold text-red-400">Emergency</h2>
        <button
          className="btn-danger w-full"
          disabled={busy}
          onClick={() => {
            if (confirm("CLOSE ALL VOTING NOW — are you sure?")) {
              post("/api/admin/kill", {}).then(
                (ok) => ok && showToast("🛑 All voting closed")
              );
            }
          }}
        >
          🛑 CLOSE ALL VOTING NOW
        </button>
      </section>
    </main>
  );
}

// ---------------- Rounds ----------------

function RoundsSection({
  ov,
  post,
  busy,
}: {
  ov: Overview;
  post: (u: string, b: unknown) => Promise<boolean>;
  busy: boolean;
}) {
  return (
    <section className="card mb-4">
      <h2 className="mb-3 font-bold">Rounds</h2>
      {(["rangoli", "dance"] as Round[]).map((round) => {
        const status = ov.settings[`${round}_status`] ?? "locked";
        const tallies = ov.tallies[round] ?? [];
        const total = tallies.reduce((s, t) => s + t.votes, 0);
        return (
          <div key={round} className="mb-4 rounded-xl bg-black/20 p-3 last:mb-0">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{ROUND_LABEL[round]}</span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                  STATUS_COLOR[status] ?? ""
                }`}
              >
                {status}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="btn-primary flex-1 text-sm"
                disabled={busy || status !== "locked"}
                onClick={() => post("/api/admin/round", { round, action: "open" })}
              >
                Open
              </button>
              <button
                className="btn-ghost flex-1 text-sm"
                disabled={busy || status !== "open"}
                onClick={() => post("/api/admin/round", { round, action: "close" })}
              >
                Close
              </button>
              <button
                className="btn-ghost flex-1 text-sm"
                disabled={busy || status !== "closed"}
                onClick={() => post("/api/admin/round", { round, action: "reveal" })}
              >
                Reveal on screen
              </button>
              {(status === "closed" || status === "revealed") && (
                <button
                  className="btn-ghost text-sm text-yellow-400"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        "Reopen this round? Voters will be able to vote again (existing votes stay). Only do this if voting was closed by mistake."
                      )
                    ) {
                      post("/api/admin/round", { round, action: "reopen" });
                    }
                  }}
                >
                  Reopen
                </button>
              )}
            </div>

            {/* Live tally — admin-only while voting runs */}
            <div className="mt-3 space-y-1">
              {tallies.map((t) => {
                const entry = ov.entries.find((e) => e.id === t.entry_id);
                if (!entry || !entry.active) return null;
                const pct = total > 0 ? Math.round((t.votes / total) * 100) : 0;
                return (
                  <div key={t.entry_id} className="flex items-center gap-2 text-sm">
                    <span className="w-32 truncate">{entry.name}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded bg-white/10">
                      <div
                        className="h-full bg-brand-saffron"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-10 text-right tabular-nums">{t.votes}</span>
                  </div>
                );
              })}
              <p className="pt-1 text-xs text-white/50">Total: {total} votes</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}

// ---------------- Screen control ----------------

function ScreenSection({
  ov,
  post,
  busy,
}: {
  ov: Overview;
  post: (u: string, b: unknown) => Promise<boolean>;
  busy: boolean;
}) {
  const current = ov.settings["screen_mode"] ?? "idle";
  return (
    <section className="card mb-4">
      <h2 className="mb-1 font-bold">Projector screen</h2>
      <p className="mb-3 text-xs text-white/50">
        The projector only changes when you press a button here.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {SCREEN_BUTTONS.map((b) => (
          <button
            key={b.mode}
            disabled={busy}
            className={`btn text-sm ${
              current === b.mode
                ? "bg-brand-saffron text-brand-navy"
                : "border border-white/20 hover:bg-white/10"
            }`}
            onClick={() => post("/api/admin/screen-mode", { mode: b.mode })}
          >
            {b.label}
          </button>
        ))}
      </div>
    </section>
  );
}

// ---------------- Entries ----------------

function EntriesSection({
  ov,
  refresh,
  showToast,
}: {
  ov: Overview;
  refresh: () => Promise<void>;
  showToast: (m: string) => void;
}) {
  const [round, setRound] = useState<Round>("rangoli");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const editFileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  async function sendForm(fd: FormData): Promise<boolean> {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/entries", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(`⚠️ ${data.error ?? "Failed"}`);
        return false;
      }
      await refresh();
      return true;
    } catch {
      showToast("⚠️ Network problem");
      return false;
    } finally {
      setSaving(false);
    }
  }

  const list = ov.entries.filter((e) => e.round === round);

  return (
    <section className="card mb-4">
      <h2 className="mb-3 font-bold">Entries</h2>
      <div className="mb-3 flex gap-2">
        {(["rangoli", "dance"] as Round[]).map((r) => (
          <button
            key={r}
            className={`btn flex-1 text-sm ${
              round === r
                ? "bg-brand-saffron text-brand-navy"
                : "border border-white/20"
            }`}
            onClick={() => setRound(r)}
          >
            {r === "rangoli" ? "Rangoli" : "Dance"}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {list.map((e) => (
          <div
            key={e.id}
            className={`flex items-center gap-3 rounded-lg bg-black/20 p-2 ${
              e.active ? "" : "opacity-50"
            }`}
          >
            {e.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={e.photo_url}
                alt=""
                className="h-12 w-12 rounded object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded bg-white/10">
                📷
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{e.name}</p>
              <p className="text-xs text-white/50">
                sort {e.sort}
                {!e.active && " · hidden"}
              </p>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={(el) => {
                editFileRefs.current[e.id] = el;
              }}
              onChange={async (ev) => {
                const f = ev.target.files?.[0];
                if (!f) return;
                const fd = new FormData();
                fd.set("action", "update");
                fd.set("id", String(e.id));
                fd.set("round", e.round);
                fd.set("sort", String(e.sort));
                fd.set("active", String(e.active));
                fd.set("photo", f);
                if (await sendForm(fd)) showToast("📷 Photo updated");
                ev.target.value = "";
              }}
            />
            <button
              className="btn-ghost px-2 py-1 text-xs"
              disabled={saving}
              onClick={() => editFileRefs.current[e.id]?.click()}
            >
              Photo
            </button>
            <button
              className="btn-ghost px-2 py-1 text-xs"
              disabled={saving}
              onClick={async () => {
                const newName = prompt("Entry name:", e.name);
                if (!newName?.trim()) return;
                const fd = new FormData();
                fd.set("action", "update");
                fd.set("id", String(e.id));
                fd.set("round", e.round);
                fd.set("name", newName.trim());
                fd.set("sort", String(e.sort));
                fd.set("active", String(e.active));
                await sendForm(fd);
              }}
            >
              Rename
            </button>
            <button
              className="btn-ghost px-2 py-1 text-xs text-red-400"
              disabled={saving}
              onClick={async () => {
                if (!confirm(`Remove "${e.name}"?`)) return;
                const fd = new FormData();
                fd.set("action", "delete");
                fd.set("id", String(e.id));
                await sendForm(fd);
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          className="input flex-1"
          placeholder={`New ${round} entry name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input type="file" accept="image/*" ref={fileRef} className="hidden" />
        <button
          className="btn-ghost text-sm"
          onClick={() => fileRef.current?.click()}
        >
          📷
        </button>
        <button
          className="btn-primary text-sm"
          disabled={saving || !name.trim()}
          onClick={async () => {
            const fd = new FormData();
            fd.set("action", "create");
            fd.set("round", round);
            fd.set("name", name.trim());
            fd.set("sort", String(list.length + 1));
            const f = fileRef.current?.files?.[0];
            if (f) fd.set("photo", f);
            if (await sendForm(fd)) {
              setName("");
              if (fileRef.current) fileRef.current.value = "";
            }
          }}
        >
          {saving ? "…" : "Add"}
        </button>
      </div>
    </section>
  );
}

// ---------------- Raffle ----------------

function RaffleSection({
  ov,
  post,
  busy,
  showToast,
}: {
  ov: Overview;
  post: (u: string, b: unknown) => Promise<boolean>;
  busy: boolean;
  showToast: (m: string) => void;
}) {
  const pool = ov.settings["raffle_pool"] ?? "range";
  const [ranges, setRanges] = useState<string | null>(null);
  const [newPrize, setNewPrize] = useState("");
  const rangesValue = ranges ?? ov.settings["active_ranges"] ?? "";

  return (
    <section className="card mb-4">
      <h2 className="mb-3 font-bold">Raffle</h2>

      <p className="mb-1 text-sm text-white/70">Who is in the draw?</p>
      <div className="mb-3 flex gap-2">
        <button
          className={`btn flex-1 text-sm ${
            pool === "range"
              ? "bg-brand-saffron text-brand-navy"
              : "border border-white/20"
          }`}
          disabled={busy}
          onClick={() => post("/api/admin/raffle", { action: "set_pool", pool: "range" })}
        >
          Distributed range
        </button>
        <button
          className={`btn flex-1 text-sm ${
            pool === "voted"
              ? "bg-brand-saffron text-brand-navy"
              : "border border-white/20"
          }`}
          disabled={busy}
          onClick={() => post("/api/admin/raffle", { action: "set_pool", pool: "voted" })}
        >
          Voted only
        </button>
      </div>

      {pool === "range" && (
        <div className="mb-3 flex gap-2">
          <input
            className="input flex-1"
            value={rangesValue}
            onChange={(e) => setRanges(e.target.value)}
            placeholder="e.g. KB-0001-KB-0650"
          />
          <button
            className="btn-ghost text-sm"
            disabled={busy}
            onClick={async () => {
              if (await post("/api/admin/raffle", { action: "set_ranges", ranges: rangesValue })) {
                setRanges(null);
                showToast("✅ Range saved");
              }
            }}
          >
            Save
          </button>
        </div>
      )}

      <button
        className="btn-ghost mb-4 w-full text-sm"
        disabled={busy}
        onClick={async () => {
          const res = await fetch("/api/admin/raffle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "pool_size" }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok) showToast(`🎟️ ${data.size} tokens eligible right now`);
          else showToast(`⚠️ ${data.error ?? "Failed"}`);
        }}
      >
        Check eligible pool size
      </button>

      <div className="space-y-2">
        {ov.prizes.map((p) => (
          <div key={p.id} className="rounded-lg bg-black/20 p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{p.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${
                  p.status === "pending"
                    ? "bg-white/15 text-white/70"
                    : p.status === "drawn"
                      ? "bg-brand-gold text-brand-navy"
                      : "bg-green-600 text-white"
                }`}
              >
                {p.status}
              </span>
            </div>
            {p.winner && (
              <p className="mt-1 text-sm text-brand-gold">
                🏆 {p.winner.display_code}
                {p.winner.holder_name ? ` — ${p.winner.holder_name}` : ""}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {p.status === "pending" && (
                <>
                  <button
                    className="btn-primary flex-1 text-sm"
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          `Draw "${p.name}" now? The projector (in Raffle mode) will spin and show the winner.`
                        )
                      ) {
                        post("/api/admin/raffle", { action: "draw", prize_id: p.id });
                      }
                    }}
                  >
                    🎲 Draw
                  </button>
                  <button
                    className="btn-ghost px-2 text-xs text-red-400"
                    disabled={busy}
                    onClick={() => {
                      if (confirm(`Delete prize "${p.name}"?`)) {
                        post("/api/admin/raffle", { action: "delete_prize", prize_id: p.id });
                      }
                    }}
                  >
                    ✕
                  </button>
                </>
              )}
              {p.status === "drawn" && (
                <>
                  <button
                    className="btn-ghost flex-1 text-sm text-yellow-400"
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          "Redraw? The current winner is discarded (they stay eligible for other prizes) and a new winner is drawn."
                        )
                      ) {
                        post("/api/admin/raffle", { action: "redraw", prize_id: p.id });
                      }
                    }}
                  >
                    🔁 Redraw
                  </button>
                  <button
                    className="btn-primary flex-1 text-sm"
                    disabled={busy}
                    onClick={() => post("/api/admin/raffle", { action: "claim", prize_id: p.id })}
                  >
                    ✅ Mark claimed
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          className="input flex-1"
          placeholder="New prize name"
          value={newPrize}
          onChange={(e) => setNewPrize(e.target.value)}
        />
        <button
          className="btn-primary text-sm"
          disabled={busy || !newPrize.trim()}
          onClick={async () => {
            if (
              await post("/api/admin/raffle", {
                action: "add_prize",
                name: newPrize.trim(),
                sort: ov.prizes.length + 1,
              })
            ) {
              setNewPrize("");
            }
          }}
        >
          Add
        </button>
      </div>
    </section>
  );
}

// ---------------- Tokens ----------------

function TokensSection({
  showToast,
  refresh,
}: {
  showToast: (m: string) => void;
  refresh: () => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<TokenRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const search = useCallback(async (query: string) => {
    try {
      const res = await fetch(
        `/api/admin/tokens?q=${encodeURIComponent(query)}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        setRows(data.tokens);
        setTotal(data.total);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(q), 300);
    return () => clearTimeout(t);
  }, [q, search]);

  async function tokenAction(action: string, id?: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) showToast(`⚠️ ${data.error ?? "Failed"}`);
      else if (action === "generate")
        showToast(`✅ Created ${data.created} tokens`);
      await search(q);
      await refresh();
    } catch {
      showToast("⚠️ Network problem");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2 className="mb-3 font-bold">Tokens</h2>

      {total === 0 && (
        <button
          className="btn-primary mb-3 w-full"
          disabled={busy}
          onClick={() => {
            if (
              confirm(
                "Generate 850 tokens now? (800 main + 50 reserve) This runs only once."
              )
            ) {
              tokenAction("generate");
            }
          }}
        >
          ⚙️ Generate 850 tokens (one time)
        </button>
      )}

      {total !== null && total > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <a className="btn-ghost text-center text-sm" href="/api/admin/tokens/export?format=csv">
            ⬇️ tokens.csv
          </a>
          <a
            className="btn-ghost text-center text-sm"
            href="/api/admin/tokens/export?format=pdf&from=1&to=8"
          >
            ⬇️ Test page (8 cards)
          </a>
          <a
            className="btn-ghost col-span-2 text-center text-sm"
            href="/api/admin/tokens/export?format=pdf"
          >
            ⬇️ Full qr-cards.pdf (850 cards)
          </a>
          <p className="col-span-2 text-center text-xs text-white/40">
            If the full PDF times out, download it in parts:
          </p>
          <a
            className="btn-ghost text-center text-xs"
            href="/api/admin/tokens/export?format=pdf&from=1&to=300"
          >
            Part 1 (1–300)
          </a>
          <a
            className="btn-ghost text-center text-xs"
            href="/api/admin/tokens/export?format=pdf&from=301&to=600"
          >
            Part 2 (301–600)
          </a>
          <a
            className="btn-ghost col-span-2 text-center text-xs"
            href="/api/admin/tokens/export?format=pdf&from=601&to=850"
          >
            Part 3 (601–850)
          </a>
        </div>
      )}

      <input
        className="input mb-2"
        placeholder="Search by code, e.g. 0347"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="max-h-72 space-y-1 overflow-y-auto">
        {rows.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2 rounded bg-black/20 p-2 text-sm"
          >
            <span className="font-mono font-semibold">{t.display_code}</span>
            {t.is_reserve && (
              <span className="rounded bg-blue-600/40 px-1.5 text-xs">reserve</span>
            )}
            {!t.active && (
              <span className="rounded bg-red-600/40 px-1.5 text-xs">void</span>
            )}
            <span className="min-w-0 flex-1 truncate text-white/50">
              {t.holder_name ?? ""}
            </span>
            {t.active ? (
              <button
                className="btn-ghost px-2 py-1 text-xs text-red-400"
                disabled={busy}
                onClick={() => {
                  if (confirm(`Void ${t.display_code}? It can no longer vote.`)) {
                    tokenAction("void", t.id);
                  }
                }}
              >
                Void
              </button>
            ) : (
              <button
                className="btn-ghost px-2 py-1 text-xs text-green-400"
                disabled={busy}
                onClick={() => tokenAction("activate", t.id)}
              >
                Activate
              </button>
            )}
          </div>
        ))}
        {rows.length === 0 && total !== 0 && (
          <p className="p-2 text-sm text-white/40">No matches.</p>
        )}
      </div>
    </section>
  );
}
