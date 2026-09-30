"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ProblemOption = {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
};

const DIFFICULTY_STYLES: Record<string, string> = {
  EASY: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20",
  MEDIUM: "border-amber-400/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20",
  HARD: "border-red-400/40 bg-red-500/10 text-red-300 hover:bg-red-500/20",
};

/**
 * Inline dialog under the room header: the room host picks the room's problem.
 * Anyone else in the room sees the switch instantly (room:update broadcast).
 */
export function ProblemPicker({
  roomId,
  isHost,
  current,
  roomEvent,
}: {
  roomId: string;
  isHost: boolean;
  current: ProblemOption | null;
  roomEvent: { seq: number; problem: ProblemOption | null; by: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const [problems, setProblems] = useState<ProblemOption[] | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ProblemOption | null>(current);
  const [notice, setNotice] = useState<string | null>(null);

  // Adopt the live "someone changed the problem" event.
  const lastSeqRef = useRef(0);
  useEffect(() => {
    if (!roomEvent || roomEvent.seq <= lastSeqRef.current) return;
    lastSeqRef.current = roomEvent.seq;
    setActive(roomEvent.problem);
    setNotice(`${roomEvent.by} changed the problem to ${roomEvent.problem?.title ?? "none"}`);
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [roomEvent]);

  async function loadProblems() {
    if (problems) return;
    try {
      const res = await fetch("/api/problems", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not load problems.");
        return;
      }
      setProblems(data.problems ?? []);
    } catch {
      setError("Network error — is the server running?");
    }
  }

  async function assign(problemId: string | null) {
    setBusyId(problemId ?? "__none__");
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}/problem`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not set the problem.");
        return;
      }
      setActive(data.problem ?? null);
      setOpen(false);
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    if (!problems) return [];
    const q = query.trim().toLowerCase();
    if (!q) return problems;
    return problems.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.difficulty.toLowerCase() === q
    );
  }, [problems, query]);

  const difficultyChip = (d: string) =>
    d === "EASY"
      ? "text-emerald-300"
      : d === "MEDIUM"
        ? "text-amber-300"
        : "text-red-300";

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="hidden truncate text-[11px] text-slate-400 sm:inline">
        {active ? (
          <>
            Problem:{" "}
            <span className={`font-semibold ${difficultyChip(active.difficulty)}`}>
              {active.title}
            </span>
          </>
        ) : (
          "No problem — free collaboration"
        )}
      </span>
      {isHost && (
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            void loadProblems();
          }}
          className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/10"
        >
          {active ? "Change" : "Pick problem"}
        </button>
      )}
      {notice && (
        <span className="truncate text-[11px] text-amber-300">{notice}</span>
      )}

      {open && (
        <div className="absolute left-1/2 top-14 z-40 w-[min(560px,92vw)] -translate-x-1/2 rounded-2xl border border-white/10 bg-navy-800 p-4 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-200">
              Choose the room&apos;s problem
            </p>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close problem picker"
              className="text-slate-500 transition hover:text-slate-200"
            >
              ✕
            </button>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, slug, or difficulty…"
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
          />
          {error && <p className="mt-2 text-[11px] text-red-300">{error}</p>}
          <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
            {(problems ?? []).length === 0 && !error && (
              <p className="py-3 text-center text-[11px] text-slate-500">Loading…</p>
            )}
            {filtered.map((p) => (
              <button
                key={p.id}
                disabled={busyId !== null}
                onClick={() => assign(p.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-xs transition disabled:opacity-50 ${
                  DIFFICULTY_STYLES[p.difficulty] ??
                  "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                } ${active?.id === p.id ? "ring-1 ring-indigo-400" : ""}`}
              >
                <span className="min-w-0 truncate font-semibold">{p.title}</span>
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide opacity-80">
                  {p.difficulty.toLowerCase()}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            Switching loads the new problem&apos;s starter code for everyone and enables Run/Submit grading.
          </p>
        </div>
      )}
    </div>
  );
}
