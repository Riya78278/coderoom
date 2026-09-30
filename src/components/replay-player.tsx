"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ReplayEvent = {
  id: string;
  type: "code" | "language" | "chat" | "submission" | "interview" | "problem";
  userId: string;
  userName: string;
  at: string;
  payload: Record<string, unknown>;
};

type ReplayData = {
  room: { id: string; name: string; status: string };
  events: ReplayEvent[];
};

const SPEEDS = [1, 2, 4, 8] as const;

const TYPE_ICONS: Record<string, string> = {
  code: "⌨",
  language: "⇄",
  chat: "💬",
  submission: "▶",
  interview: "🎙",
  problem: "📋",
};

/**
 * Folds the raw timeline into playable frames. Consecutive code events are
 * collapsed into "typing bursts" so the scrubber jumps document-state to
 * document-state instead of every 2-second sample.
 */
function buildFrames(events: ReplayEvent[]) {
  type Frame = {
    at: number;
    t: ReplayEvent;
    code: string;
    language: string;
    chat: { name: string; content: string }[];
    markers: ReplayEvent[];
  };
  const frames: Frame[] = [];
  let code = "";
  let language = "javascript";
  const chat: { name: string; content: string }[] = [];

  for (const ev of events) {
    const at = +new Date(ev.at);
    const p = ev.payload as Record<string, unknown>;
    if (ev.type === "code") {
      code = String(p.code ?? code);
      if (typeof p.language === "string") language = p.language;
    } else if (ev.type === "language") {
      language = String(p.language ?? language);
    } else if (ev.type === "chat") {
      chat.push({ name: String(p.name ?? ev.userName), content: String(p.content ?? "") });
    }
    if (ev.type === "code" && frames.length > 0) {
      const last = frames[frames.length - 1];
      if (last.t.type === "code" && at - last.at < 4000) {
        // Collapse into the previous burst.
        last.code = code;
        last.language = language;
        last.at = at;
        last.t = ev;
        continue;
      }
    }
    frames.push({ at, t: ev, code, language, chat: [...chat], markers: [] });
  }

  // Attach non-code events as markers on the nearest following frame.
  for (const f of frames) {
    for (const ev of events) {
      const at = +new Date(ev.at);
      if (
        ev.type !== "code" &&
        ev.type !== "language" &&
        at >= f.at &&
        at < f.at + 2500
      ) {
        f.markers.push(ev);
      }
    }
  }
  return frames;
}

export function ReplayPlayer({ roomId }: { roomId: string }) {
  const [data, setData] = useState<ReplayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(2);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`/api/rooms/${roomId}/replay`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.events) setData(d);
        else setError("Could not load the replay.");
      })
      .catch(() => setError("Could not load the replay."));
  }, [roomId]);

  const frames = useMemo(() => buildFrames(data?.events ?? []), [data]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!playing) return;
    timerRef.current = setInterval(() => {
      setFrameIdx((i) => {
        if (i >= frames.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 900 / speed);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, speed, frames.length]);

  if (error) {
    return <p className="card p-6 text-sm text-red-500">{error}</p>;
  }
  if (!data) {
    return <p className="card p-6 text-sm text-slate-500">Loading replay…</p>;
  }
  if (frames.length === 0) {
    return (
      <p className="card p-6 text-sm text-slate-500">
        Nothing recorded in this session yet — typing, chat, submissions, and
        interview events appear here once they happen.
      </p>
    );
  }

  const frame = frames[Math.min(frameIdx, frames.length - 1)];
  const startAt = frames[0].at;
  const endAt = frames[frames.length - 1].at;
  const pct =
    endAt > startAt ? Math.round(((frame.at - startAt) / (endAt - startAt)) * 100) : 100;
  const elapsedS = Math.round((frame.at - startAt) / 1000);
  const mmss = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-800">Replay</span>
          <span>
            {mmss(elapsedS)} · frame {frameIdx + 1}/{frames.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {[1, 2, 4, 8].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s as (typeof SPEEDS)[number])}
              className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                speed === s
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* Scrubber */}
      <div className="px-4 pt-3">
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={Math.min(frameIdx, frames.length - 1)}
          onChange={(e) => {
            setPlaying(false);
            setFrameIdx(Number(e.target.value));
          }}
          className="w-full accent-indigo-600"
          aria-label="Replay position"
        />
      </div>

      {/* Code + chat side by side */}
      <div className="grid gap-0 md:grid-cols-3">
        <pre className="max-h-96 overflow-auto bg-slate-950 p-4 font-mono text-[11px] leading-relaxed text-slate-100 md:col-span-2">
          {frame.code || "(empty editor)"}
        </pre>
        <div className="max-h-96 overflow-auto border-l border-slate-200 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Chat & events
          </p>
          <div className="space-y-1.5">
            {frame.chat.slice(-30).map((c, i) => (
              <p key={i} className="text-[11px] text-slate-700">
                <span className="font-semibold">{c.name}:</span> {c.content}
              </p>
            ))}
            {frame.markers.map((m, i) => (
              <p key={`m${i}`} className="text-[11px] text-indigo-600">
                {TYPE_ICONS[m.type] ?? "•"} {m.userName} —{" "}
                {m.type === "submission"
                  ? `${String((m.payload as Record<string, unknown>).verdict ?? "result")} (${String((m.payload as Record<string, unknown>).passed ?? "?")}/${String((m.payload as Record<string, unknown>).total ?? "?")})`
                  : m.type === "interview"
                    ? `interview ${String((m.payload as Record<string, unknown>).action ?? "")}`
                    : m.type === "problem"
                      ? `problem: ${String((m.payload as Record<string, unknown>).title ?? "none")}`
                      : m.type}
              </p>
            ))}
            {frame.chat.length === 0 && frame.markers.length === 0 && (
              <p className="text-[11px] text-slate-400">—</p>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (frameIdx >= frames.length - 1) setFrameIdx(0);
              setPlaying((p) => !p);
            }}
            className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
          >
            {playing ? "⏸ Pause" : "▶ Play"}
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              setFrameIdx(0);
            }}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
          >
            ↺ Restart
          </button>
        </div>
        <span className="text-[11px] text-slate-500">
          {pct}% · language: {frame.language}
        </span>
      </div>
    </div>
  );
}
