"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { APP_VERSION } from "@/lib/version";

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
  rangoli: "Round 1 · Rangoli",
  dance: "Round 2 · Dance",
};
const ROUND_ICON: Record<Round, string> = { rangoli: "🎨", dance: "💃" };
const STATUS_STYLE: Record<string, string> = {
  locked: "bg-white/10 text-white/60",
  open: "bg-green-500/90 text-white shadow shadow-green-500/40",
  closed: "bg-yellow-500/90 text-black",
  revealed: "bg-purple-500/90 text-white",
};
const SCREEN_BUTTONS: { mode: string; label: string; icon: string }[] = [
  { mode: "idle", label: "Idle / branding", icon: "🏠" },
  { mode: "live_r1", label: "Live count · Rangoli", icon: "🎨" },
  { mode: "results_r1", label: "Results · Rangoli", icon: "🏆" },
  { mode: "live_r2", label: "Live count · Dance", icon: "💃" },
  { mode: "results_r2", label: "Results · Dance", icon: "🏆" },
  { mode: "raffle", label: "Raffle", icon: "🎁" },
];
const NAV = [
  { id: "rounds", label: "Rounds", icon: "🗳️" },
  { id: "screen", label: "Screen", icon: "📺" },
  { id: "entries", label: "Entries", icon: "🖼️" },
  { id: "raffle", label: "Raffle", icon: "🎁" },
  { id: "tokens", label: "Tokens", icon: "🎟️" },
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
    toastTimer.current = setTimeout(() => setToast(""), 4500);
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

  const turnoutPct =
    ov.turnout.active > 0
      ? Math.round((ov.turnout.voted / ov.turnout.active) * 100)
      : 0;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 -mx-4 mb-5 border-b border-white/10 bg-brand-navy/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="bg-gradient-to-r from-brand-saffron to-brand-gold bg-clip-text text-xl font-extrabold text-transparent">
              🎛️ Control Room
            </h1>
            <p className="text-xs text-white/50">
              Maa Tujhe Salaam · Kenbharti · {APP_VERSION}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-white/5 px-3 py-1.5 text-right">
              <p className="text-sm font-bold leading-tight text-brand-gold">
                {ov.turnout.voted} / {ov.turnout.active}
              </p>
              <p className="text-[10px] leading-tight text-white/50">
                voted · {turnoutPct}%
              </p>
            </div>
            <button
              className="btn-ghost px-3 py-1.5 text-xs"
              onClick={async () => {
                await fetch("/api/admin/logout", { method: "POST" });
                window.location.reload();
              }}
            >
              Log out
            </button>
          </div>
        </div>
        {/* Section nav */}
        <nav className="mt-3 flex gap-2 overflow-x-auto pb-0.5">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className="chip whitespace-nowrap border border-white/10 bg-white/5 text-white/80 hover:bg-white/15"
            >
              {n.icon} {n.label}
            </a>
          ))}
        </nav>
      </header>

      {toast && (
        <div className="fixed inset-x-4 top-4 z-50 rounded-xl border border-white/10 bg-black/95 p-3 text-center shadow-2xl">
          {toast}
        </div>
      )}

      <div className="space-y-5">
        <SystemCheckSection />
        <RoundsSection ov={ov} post={post} busy={busy} showToast={showToast} />
        <ScreenSection ov={ov} post={post} busy={busy} />
        <BrandingSection ov={ov} refresh={refresh} showToast={showToast} />
        <EntriesSection ov={ov} refresh={refresh} showToast={showToast} />
        <RaffleSection ov={ov} post={post} busy={busy} showToast={showToast} />
        <TokensSection showToast={showToast} refresh={refresh} />

        {/* Kill switch */}
        <section className="card border-red-500/30">
          <SectionTitle icon="🛑" title="Emergency" sub="Instantly closes any open round." />
          <button
            className="btn-danger w-full text-base"
            disabled={busy}
            onClick={() => {
              if (confirm("CLOSE ALL VOTING NOW — are you sure?")) {
                post("/api/admin/kill", {}).then(
                  (ok) => ok && showToast("🛑 All voting closed")
                );
              }
            }}
          >
            CLOSE ALL VOTING NOW
          </button>
        </section>
      </div>
    </main>
  );
}

function SectionTitle({
  icon,
  title,
  sub,
}: {
  icon: string;
  title: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-lg">
          {icon}
        </span>
        {title}
      </h2>
      {sub && <p className="mt-1 text-xs text-white/50">{sub}</p>}
    </div>
  );
}

// ---------------- System check ----------------

type HealthCheck = { name: string; ok: boolean; detail: string; fix?: string };

function SystemCheckSection() {
  const [checks, setChecks] = useState<HealthCheck[] | null>(null);
  const [allOk, setAllOk] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/admin/health", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setChecks(data.checks);
        setAllOk(data.ok);
        if (!data.ok) setExpanded(true);
      }
    } catch {
      setAllOk(false);
      setChecks([
        {
          name: "Server",
          ok: false,
          detail: "Could not run the check — network problem?",
        },
      ]);
      setExpanded(true);
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <section
      className={`card ${
        allOk === false
          ? "border-red-500/50"
          : allOk
            ? "border-green-500/30"
            : ""
      }`}
    >
      <button
        className="flex w-full items-center justify-between"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="flex items-center gap-2 text-lg font-bold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-lg">
            {allOk === null ? "⏳" : allOk ? "💚" : "🚨"}
          </span>
          System check
          {allOk === true && (
            <span className="rounded-full bg-green-500/20 px-2.5 py-0.5 text-xs font-bold text-green-300">
              ALL GOOD
            </span>
          )}
          {allOk === false && (
            <span className="rounded-full bg-red-500/30 px-2.5 py-0.5 text-xs font-bold text-red-200">
              PROBLEMS FOUND
            </span>
          )}
        </span>
        <span className="text-white/40">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-1.5">
          {(checks ?? []).map((c) => (
            <div
              key={c.name}
              className={`rounded-xl p-2.5 text-sm ${
                c.ok ? "bg-black/20" : "border border-red-500/40 bg-red-500/10"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  {c.ok ? "✅" : "❌"} {c.name}
                </span>
                <span
                  className={`text-xs ${c.ok ? "text-white/40" : "text-red-300"}`}
                >
                  {c.detail}
                </span>
              </div>
              {!c.ok && c.fix && (
                <p className="mt-1 text-xs text-white/70">👉 {c.fix}</p>
              )}
            </div>
          ))}
          <button
            className="btn-ghost mt-2 w-full py-2 text-sm"
            disabled={running}
            onClick={run}
          >
            {running ? "⏳ Checking…" : "🔄 Run check again"}
          </button>
        </div>
      )}
    </section>
  );
}

// ---------------- Rounds ----------------

function RoundsSection({
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
  return (
    <section id="rounds" className="card scroll-mt-32">
      <SectionTitle
        icon="🗳️"
        title="Rounds"
        sub="Open → Close → Reveal. Nothing moves unless you press it."
      />
      <div className="space-y-4">
        {(["rangoli", "dance"] as Round[]).map((round) => {
          const status = ov.settings[`${round}_status`] ?? "locked";
          const tallies = ov.tallies[round] ?? [];
          const total = tallies.reduce((s, t) => s + t.votes, 0);
          const maxVotes = Math.max(1, ...tallies.map((t) => t.votes));
          return (
            <div
              key={round}
              className="rounded-2xl border border-white/5 bg-black/25 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-bold">
                  <span className="text-xl">{ROUND_ICON[round]}</span>
                  {ROUND_LABEL[round]}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wider ${
                    STATUS_STYLE[status] ?? ""
                  }`}
                >
                  {status}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  className="btn-primary py-2.5 text-sm"
                  disabled={busy || status !== "locked"}
                  onClick={async () => {
                    if (await post("/api/admin/round", { round, action: "open" })) {
                      showToast(
                        `✅ ${round === "rangoli" ? "Rangoli" : "Dance"} is open! Now press "Live count" in the Projector section 👇`
                      );
                    }
                  }}
                >
                  ▶ Open
                </button>
                <button
                  className="btn-ghost py-2.5 text-sm"
                  disabled={busy || status !== "open"}
                  onClick={() => post("/api/admin/round", { round, action: "close" })}
                >
                  ⏸ Close
                </button>
                <button
                  className="btn-ghost py-2.5 text-sm"
                  disabled={busy || status !== "closed"}
                  onClick={() => post("/api/admin/round", { round, action: "reveal" })}
                >
                  🏆 Reveal
                </button>
              </div>
              {(status === "closed" || status === "revealed") && (
                <button
                  className="mt-2 w-full rounded-lg py-1 text-xs text-yellow-400/80 hover:bg-white/5"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        "Reopen this round? Voters can vote again (existing votes stay). Only if it was closed by mistake."
                      )
                    ) {
                      post("/api/admin/round", { round, action: "reopen" });
                    }
                  }}
                >
                  ↩︎ Reopen (mistake only)
                </button>
              )}

              {/* Live tally — only visible here, never on the projector */}
              <div className="mt-4 space-y-2">
                {tallies.map((t) => {
                  const entry = ov.entries.find((e) => e.id === t.entry_id);
                  if (!entry || !entry.active) return null;
                  const leading = t.votes === maxVotes && total > 0;
                  return (
                    <div key={t.entry_id} className="flex items-center gap-2 text-sm">
                      <span
                        className={`w-32 truncate ${leading ? "font-bold text-brand-gold" : ""}`}
                      >
                        {entry.name}
                      </span>
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            leading
                              ? "bg-gradient-to-r from-brand-gold to-brand-saffron"
                              : "bg-brand-saffron/50"
                          }`}
                          style={{ width: `${(t.votes / maxVotes) * 100}%` }}
                        />
                      </div>
                      <span className="w-10 text-right font-mono text-xs">
                        {t.votes}
                      </span>
                    </div>
                  );
                })}
                <p className="pt-1 text-right text-xs text-white/40">
                  {total} vote{total === 1 ? "" : "s"} in this round
                </p>
              </div>
            </div>
          );
        })}
      </div>
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
    <section id="screen" className="card scroll-mt-32">
      <SectionTitle
        icon="📺"
        title="Projector screen"
        sub={
          <>
            Open <b>/screen</b> on the projector laptop. It only changes when
            you press here.
          </>
        }
      />
      <div className="grid grid-cols-2 gap-2">
        {SCREEN_BUTTONS.map((b) => {
          const active = current === b.mode;
          return (
            <button
              key={b.mode}
              disabled={busy}
              className={`btn flex items-center gap-2 py-3 text-left text-sm ${
                active
                  ? "bg-gradient-to-b from-amber-400 to-brand-saffron text-brand-navy shadow-lg shadow-amber-500/30"
                  : "border border-white/10 bg-white/5 hover:bg-white/10"
              }`}
              onClick={() => post("/api/admin/screen-mode", { mode: b.mode })}
            >
              <span className="text-lg">{b.icon}</span>
              <span className="flex-1 leading-tight">{b.label}</span>
              {active && <span className="text-xs font-black">● LIVE</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------------- Branding (event logo) ----------------

function BrandingSection({
  ov,
  refresh,
  showToast,
}: {
  ov: Overview;
  refresh: () => Promise<void>;
  showToast: (m: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const logo = ov.settings["logo_url"];

  return (
    <section className="card">
      <SectionTitle
        icon="🦋"
        title="Event logo"
        sub="Shown on every voter's phone and on the projector. Upload once."
      />
      <div className="flex items-center gap-4">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt="Event logo"
            className="h-20 w-20 rounded-xl bg-white/90 object-contain p-1"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 text-3xl">
            🦋
          </div>
        )}
        <div className="flex-1">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileRef}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setUploading(true);
              try {
                const fd = new FormData();
                fd.set("logo", f);
                const res = await fetch("/api/admin/branding", {
                  method: "POST",
                  body: fd,
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                  showToast("✅ Logo uploaded — it now shows on phones & projector");
                  await refresh();
                } else {
                  showToast(`⚠️ ${data.error ?? "Upload failed"}`);
                }
              } catch {
                showToast("⚠️ Network problem");
              } finally {
                setUploading(false);
                e.target.value = "";
              }
            }}
          />
          <button
            className="btn-primary w-full text-sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading
              ? "⏳ Uploading…"
              : logo
                ? "📷 Replace logo"
                : "📷 Upload the Kenbharti logo"}
          </button>
          <p className="mt-1.5 text-[11px] text-white/40">
            Use the butterfly logo image — PNG with white or transparent
            background looks best.
          </p>
        </div>
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
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [newPreview, setNewPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
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

  function pickNewPhoto(f: File | null) {
    setNewPhoto(f);
    if (newPreview) URL.revokeObjectURL(newPreview);
    setNewPreview(f ? URL.createObjectURL(f) : null);
  }

  const list = ov.entries.filter((e) => e.round === round);

  return (
    <section id="entries" className="card scroll-mt-32">
      <SectionTitle
        icon="🖼️"
        title="Entries"
        sub="The photos & names voters choose between. Editable any time — even mid-event."
      />

      <div className="mb-4 flex gap-2 rounded-xl bg-black/25 p-1">
        {(["rangoli", "dance"] as Round[]).map((r) => (
          <button
            key={r}
            className={`chip flex-1 py-2 ${
              round === r
                ? "bg-brand-saffron text-brand-navy shadow"
                : "text-white/60 hover:text-white"
            }`}
            onClick={() => setRound(r)}
          >
            {ROUND_ICON[r]} {r === "rangoli" ? "Rangoli" : "Dance"}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {list.map((e) => (
          <div
            key={e.id}
            className={`flex items-center gap-3 rounded-xl border border-white/5 bg-black/25 p-2.5 ${
              e.active ? "" : "opacity-40"
            }`}
          >
            {e.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={e.photo_url}
                alt=""
                className="h-14 w-14 rounded-lg border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 flex-col items-center justify-center rounded-lg border border-dashed border-white/20 bg-white/5 text-[10px] text-white/40">
                <span className="text-base">📷</span>
                no photo
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{e.name}</p>
              <p className="text-xs text-white/40">
                #{e.sort}
                {!e.active && " · hidden from ballot"}
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
                setUploadingId(e.id);
                const fd = new FormData();
                fd.set("action", "update");
                fd.set("id", String(e.id));
                fd.set("round", e.round);
                fd.set("sort", String(e.sort));
                fd.set("active", String(e.active));
                fd.set("photo", f);
                if (await sendForm(fd)) showToast("✅ Photo updated");
                setUploadingId(null);
                ev.target.value = "";
              }}
            />
            <div className="flex flex-col gap-1">
              <button
                className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold hover:bg-white/20"
                disabled={saving}
                onClick={() => editFileRefs.current[e.id]?.click()}
              >
                {uploadingId === e.id ? "⏳ Uploading…" : "📷 Photo"}
              </button>
              <button
                className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold hover:bg-white/20"
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
                ✏️ Rename
              </button>
            </div>
            <button
              className="rounded-lg px-2 py-1 text-red-400/80 hover:bg-red-500/10"
              disabled={saving}
              title="Remove"
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
        {list.length === 0 && (
          <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-white/40">
            No entries yet — add the first one below.
          </p>
        )}
      </div>

      {/* Add new entry */}
      <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">
          Add new {round} entry
        </p>
        <input
          className="input mb-2"
          placeholder="Name (e.g. 'Team Diwali Stars')"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="file"
          accept="image/*"
          ref={fileRef}
          className="hidden"
          onChange={(e) => pickNewPhoto(e.target.files?.[0] ?? null)}
        />
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost flex flex-1 items-center justify-center gap-2 py-2.5 text-sm"
            onClick={() => fileRef.current?.click()}
          >
            {newPreview ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={newPreview}
                  alt=""
                  className="h-8 w-8 rounded object-cover"
                />
                <span className="truncate text-xs text-green-400">
                  ✓ {newPhoto?.name}
                </span>
              </>
            ) : (
              <>📷 Choose photo (optional)</>
            )}
          </button>
          <button
            className="btn-primary px-6 py-2.5 text-sm"
            disabled={saving || !name.trim()}
            onClick={async () => {
              const fd = new FormData();
              fd.set("action", "create");
              fd.set("round", round);
              fd.set("name", name.trim());
              fd.set("sort", String(list.length + 1));
              if (newPhoto) fd.set("photo", newPhoto);
              if (await sendForm(fd)) {
                setName("");
                pickNewPhoto(null);
                if (fileRef.current) fileRef.current.value = "";
                showToast("✅ Entry added");
              }
            }}
          >
            {saving ? "⏳ Saving…" : "＋ Add"}
          </button>
        </div>
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
    <section id="raffle" className="card scroll-mt-32">
      <SectionTitle
        icon="🎁"
        title="Raffle"
        sub="Hampers first, flight tickets last. Winners can never win twice."
      />

      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">
        Who is in the draw?
      </p>
      <div className="mb-3 flex gap-2 rounded-xl bg-black/25 p-1">
        <button
          className={`chip flex-1 py-2 ${
            pool === "range"
              ? "bg-brand-saffron text-brand-navy shadow"
              : "text-white/60 hover:text-white"
          }`}
          disabled={busy}
          onClick={() => post("/api/admin/raffle", { action: "set_pool", pool: "range" })}
        >
          🎫 Distributed range
        </button>
        <button
          className={`chip flex-1 py-2 ${
            pool === "voted"
              ? "bg-brand-saffron text-brand-navy shadow"
              : "text-white/60 hover:text-white"
          }`}
          disabled={busy}
          onClick={() => post("/api/admin/raffle", { action: "set_pool", pool: "voted" })}
        >
          ✅ Voted only
        </button>
      </div>

      {pool === "range" && (
        <div className="mb-3 flex gap-2">
          <input
            className="input flex-1 font-mono text-sm"
            value={rangesValue}
            onChange={(e) => setRanges(e.target.value)}
            placeholder="KB-0001-KB-0650"
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
        className="btn-ghost mb-4 w-full py-2 text-sm"
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
        🔍 Check eligible pool size
      </button>

      <div className="space-y-2">
        {ov.prizes.map((p) => (
          <div
            key={p.id}
            className={`rounded-xl border p-3 ${
              p.status === "drawn"
                ? "border-brand-gold/40 bg-brand-gold/5"
                : p.status === "claimed"
                  ? "border-green-500/30 bg-green-500/5"
                  : "border-white/5 bg-black/25"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold">
                {p.name.toLowerCase().includes("flight") ? "✈️" : "🧺"} {p.name}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                  p.status === "pending"
                    ? "bg-white/10 text-white/60"
                    : p.status === "drawn"
                      ? "bg-brand-gold text-brand-navy"
                      : "bg-green-500 text-white"
                }`}
              >
                {p.status === "pending" ? "not drawn" : p.status}
              </span>
            </div>
            {p.winner && (
              <p className="mt-1.5 text-sm font-semibold text-brand-gold">
                🏆 {p.winner.display_code}
                {p.winner.holder_name ? ` — ${p.winner.holder_name}` : ""}
              </p>
            )}
            <div className="mt-2.5 flex flex-wrap gap-2">
              {p.status === "pending" && (
                <>
                  <button
                    className="btn-primary flex-1 py-2 text-sm"
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          `Draw "${p.name}" now? The projector (in Raffle mode) will spin and land on the winner.`
                        )
                      ) {
                        post("/api/admin/raffle", { action: "draw", prize_id: p.id });
                      }
                    }}
                  >
                    🎲 Draw
                  </button>
                  <button
                    className="rounded-lg px-2 text-xs text-red-400/70 hover:bg-red-500/10"
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
                    className="btn-ghost flex-1 py-2 text-sm text-yellow-300"
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          "Redraw? Current winner is discarded (they stay eligible for other prizes) and a new one is drawn."
                        )
                      ) {
                        post("/api/admin/raffle", { action: "redraw", prize_id: p.id });
                      }
                    }}
                  >
                    🔁 Redraw
                  </button>
                  <button
                    className="btn-primary flex-1 py-2 text-sm"
                    disabled={busy}
                    onClick={() => post("/api/admin/raffle", { action: "claim", prize_id: p.id })}
                  >
                    ✅ Claimed
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
          className="btn-primary px-5 text-sm"
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
          ＋ Add
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
  const [generating, setGenerating] = useState(false);
  const [qrToken, setQrToken] = useState<TokenRow | null>(null);

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
    if (action === "generate") setGenerating(true);
    try {
      const res = await fetch("/api/admin/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) showToast(`⚠️ ${data.error ?? "Failed"}`);
      else if (action === "generate")
        showToast(`✅ Created ${data.created} tokens — now download the test page and print it`);
      await search(q);
      await refresh();
    } catch {
      showToast("⚠️ Network problem");
    } finally {
      setBusy(false);
      setGenerating(false);
    }
  }

  return (
    <section id="tokens" className="card scroll-mt-32">
      <SectionTitle
        icon="🎟️"
        title="Tokens & QR cards"
        sub="Each card = one unique QR code = one voter. 800 main + 50 reserve."
      />

      {total === 0 && (
        <div className="mb-4 rounded-xl border border-dashed border-brand-saffron/40 bg-brand-saffron/5 p-4 text-center">
          <p className="mb-1 text-2xl">🎫</p>
          <p className="mb-1 font-bold">No tokens exist yet</p>
          <p className="mb-3 text-xs text-white/60">
            Press once to create all 850 QR codes (KB-0001 → KB-0850).
            <br />
            Takes ~10 seconds. Then the download buttons appear here.
          </p>
          <button
            className="btn-primary w-full"
            disabled={busy}
            onClick={() => {
              if (confirm("Generate 850 tokens now? This runs only once.")) {
                tokenAction("generate");
              }
            }}
          >
            {generating ? "⏳ Creating 850 tokens…" : "⚙️ Generate 850 tokens"}
          </button>
        </div>
      )}

      {total !== null && total > 0 && (
        <div className="mb-4 rounded-xl border border-white/10 bg-black/25 p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">
            Downloads · {total} tokens exist
          </p>
          <div className="grid grid-cols-2 gap-2">
            <a
              className="btn-ghost py-2.5 text-center text-sm"
              href="/api/admin/tokens/export?format=pdf&from=1&to=8"
            >
              🖨️ Test page (8 cards)
            </a>
            <a
              className="btn-ghost py-2.5 text-center text-sm"
              href="/api/admin/tokens/export?format=csv"
            >
              📋 tokens.csv
            </a>
            <a
              className="btn-primary col-span-2 py-2.5 text-center text-sm"
              href="/api/admin/tokens/export?format=pdf"
            >
              ⬇️ Full qr-cards.pdf — 850 cards, 107 pages
            </a>
          </div>
          <p className="mt-2 text-center text-[11px] text-white/40">
            Print the test page and scan it with 3 phones before mass printing.
            If the full PDF times out, use parts:{" "}
            <a className="underline" href="/api/admin/tokens/export?format=pdf&from=1&to=300">1–300</a>
            {" · "}
            <a className="underline" href="/api/admin/tokens/export?format=pdf&from=301&to=600">301–600</a>
            {" · "}
            <a className="underline" href="/api/admin/tokens/export?format=pdf&from=601&to=850">601–850</a>
          </p>
        </div>
      )}

      <input
        className="input mb-2"
        placeholder="🔍 Search a card, e.g. 0347"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
        {rows.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2 rounded-xl border border-white/5 bg-black/25 p-2 text-sm"
          >
            <button
              className="rounded-lg bg-white/10 px-2 py-1.5 text-xs hover:bg-white/20"
              title="Show QR code"
              onClick={() => setQrToken(t)}
            >
              🔳
            </button>
            <span className="font-mono font-bold">{t.display_code}</span>
            {t.is_reserve && (
              <span className="rounded-full bg-blue-500/30 px-2 py-0.5 text-[10px] font-bold text-blue-200">
                RESERVE
              </span>
            )}
            {!t.active && (
              <span className="rounded-full bg-red-500/30 px-2 py-0.5 text-[10px] font-bold text-red-200">
                VOID
              </span>
            )}
            <span className="min-w-0 flex-1 truncate text-xs text-white/40">
              {t.holder_name ?? ""}
            </span>
            {t.active ? (
              <button
                className="rounded-lg px-2 py-1 text-xs font-semibold text-red-400/80 hover:bg-red-500/10"
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
                className="rounded-lg bg-green-500/20 px-2 py-1 text-xs font-semibold text-green-300 hover:bg-green-500/30"
                disabled={busy}
                onClick={() => tokenAction("activate", t.id)}
              >
                Activate
              </button>
            )}
          </div>
        ))}
        {rows.length === 0 && total !== 0 && (
          <p className="p-3 text-center text-sm text-white/40">No matches.</p>
        )}
      </div>

      {/* QR preview modal */}
      {qrToken && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setQrToken(null)}
        >
          <div
            className="card w-full max-w-xs border-brand-saffron/40 bg-brand-navy text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 font-mono text-2xl font-extrabold">
              {qrToken.display_code}
            </p>
            <div className="overflow-hidden rounded-xl bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/admin/tokens/qr?id=${qrToken.id}`}
                alt={`QR for ${qrToken.display_code}`}
                className="mx-auto w-full"
              />
            </div>
            <p className="mt-3 text-xs text-white/50">
              Scanning this opens that card&apos;s voting page — try it with
              your phone right now.
            </p>
            <button className="btn-ghost mt-3 w-full" onClick={() => setQrToken(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
