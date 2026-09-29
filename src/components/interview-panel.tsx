"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type ActiveInterview = {
  id: string;
  interviewerId: string;
  candidateId: string;
  startedAt: string;
} | null;

export type InterviewEvent = {
  action: "started" | "ended";
  interviewId: string | null;
  name: string;
  seq: number;
};

type MemberLite = { userId: string; name: string; role: string };

function fmt(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function InterviewPanel({
  roomId,
  isHost,
  members,
  activeInterview,
  interviewEvent,
}: {
  roomId: string;
  isHost: boolean;
  members: MemberLite[];
  activeInterview: ActiveInterview;
  interviewEvent: InterviewEvent | null;
}) {
  const router = useRouter();
  const [interview, setInterview] = useState<ActiveInterview>(activeInterview);
  const [dialog, setDialog] = useState<"start" | "end" | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const refetch = useCallback(() => {
    fetch(`/api/rooms/${roomId}/interview`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setInterview(d?.interview ?? null))
      .catch(() => undefined);
  }, [roomId]);

  // Live events from the other participant.
  const lastSeqRef = useRef(0);
  useEffect(() => {
    if (!interviewEvent || interviewEvent.seq <= lastSeqRef.current) return;
    lastSeqRef.current = interviewEvent.seq;
    if (interviewEvent.action === "started") {
      setNotice(`${interviewEvent.name} started an interview session`);
      refetch();
    } else {
      setNotice(`${interviewEvent.name} ended the interview session`);
      setInterview(null);
      router.refresh();
    }
  }, [interviewEvent, refetch, router]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  // Live timer.
  useEffect(() => {
    if (!interview) {
      setElapsed(0);
      return;
    }
    const started = new Date(interview.startedAt).getTime();
    const tick = () =>
      setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [interview]);

  const candidateName =
    members.find((m) => m.userId === interview?.candidateId)?.name ??
    "Selected member";

  async function start(candidateId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice(data?.error ?? "Could not start the interview.");
        return;
      }
      setInterview(data.interview);
      setDialog(null);
    } catch {
      setNotice("Network error — is the server running?");
    } finally {
      setBusy(false);
    }
  }

  async function end(rating: number | null, feedback: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/interview`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, feedback }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice(data?.error ?? "Could not end the interview.");
        return;
      }
      setInterview(null);
      setDialog(null);
      router.refresh();
    } catch {
      setNotice("Network error — is the server running?");
    } finally {
      setBusy(false);
    }
  }

  if (interview) {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-indigo-400/20 bg-indigo-500/10 px-4 py-2">
        <span className="flex items-center gap-2 text-xs font-medium text-indigo-200">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-400" />
          </span>
          Interview in progress — candidate: {candidateName} · {fmt(elapsed)}
        </span>
        {isHost ? (
          <button
            onClick={() => setDialog("end")}
            className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-indigo-500"
          >
            End & review
          </button>
        ) : (
          <span className="text-[11px] text-indigo-300/70">waiting for interviewer to end…</span>
        )}
      </div>
    );
  }

  if (!isHost) return null;

  if (dialog === "start") {
    const candidates = members.filter((m) => m.role !== "HOST");
    return (
      <div className="border-b border-white/10 bg-navy-800 px-4 py-3">
        <p className="text-xs font-semibold text-slate-200">Start an interview session</p>
        <p className="mt-0.5 text-[11px] text-slate-400">
          Pick the candidate. A timer starts; ending it snapshots the code and saves the session to history.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {candidates.map((m) => (
            <button
              key={m.userId}
              disabled={busy}
              onClick={() => start(m.userId)}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              Interview {m.name}
            </button>
          ))}
          <button
            onClick={() => setDialog(null)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10"
          >
            Cancel
          </button>
        </div>
        {members.length < 2 && (
          <p className="mt-2 text-[11px] text-amber-300">
            You need another member in the room to run an interview — share the join code.
          </p>
        )}
      </div>
    );
  }

  if (dialog === "end") {
    return (
      <EndForm busy={busy} onEnd={end} onCancel={() => setDialog(null)} />
    );
  }

  return (
    <div className="border-b border-white/10 bg-navy-800 px-4 py-2">
      <button
        onClick={() => setDialog("start")}
        className="text-xs font-semibold text-indigo-300 transition hover:text-indigo-200"
      >
        ▶ Start interview session…
      </button>
      {notice && <span className="ml-3 text-[11px] text-slate-400">{notice}</span>}
    </div>
  );
}

function EndForm({
  busy,
  onEnd,
  onCancel,
}: {
  busy: boolean;
  onEnd: (rating: number | null, feedback: string) => void;
  onCancel: () => void;
}) {
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");

  return (
    <div className="border-b border-white/10 bg-navy-800 px-4 py-3">
      <p className="text-xs font-semibold text-slate-200">End session & review</p>
      <div className="mt-2 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setRating(rating === n ? null : n)}
            className={`text-lg transition ${rating && n <= rating ? "text-amber-300" : "text-slate-600 hover:text-slate-400"}`}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            ★
          </button>
        ))}
        <span className="ml-2 text-[11px] text-slate-400">rating (optional)</span>
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Feedback for the candidate (optional)…"
        className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
      />
      <div className="mt-2 flex gap-2">
        <button
          disabled={busy}
          onClick={() => onEnd(rating, feedback.trim())}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          End interview
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
