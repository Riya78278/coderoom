"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CodeEditor } from "@/components/code-editor";
import { ProblemPanel } from "@/components/problem-panel";
import { ProblemPicker } from "@/components/problem-picker";
import { ChatPanel } from "@/components/chat-panel";
import { PresenceBar } from "@/components/presence-bar";
import { CopyJoinCode } from "@/components/copy-join-code";
import { AiHint } from "@/components/ai-hint";
import {
  InterviewPanel,
  type ActiveInterview,
} from "@/components/interview-panel";
import {
  OutputPanel,
  type ExecState,
} from "@/components/output-panel";
import { useRoomSocket } from "@/hooks/use-room-socket";
import {
  ROOM_LANGUAGES,
  MONACO_LANGUAGE,
  languageLabel,
  starterCodeFor,
} from "@/lib/languages";

type WorkspaceProblem = {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  description: string;
  examples: unknown;
  constraints: string[];
} | null;

type WorkspaceMember = {
  id: string;
  role: string;
  user: { id: string; name: string; email: string };
};

export type RoomWorkspaceProps = {
  room: {
    id: string;
    name: string;
    joinCode: string;
    language: string;
    code: string;
    status: string;
  };
  problem: WorkspaceProblem;
  members: WorkspaceMember[];
  me: { id: string; name: string; role: string };
  activeInterview: ActiveInterview;
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

function SaveIndicator({ state }: { state: SaveState }) {
  const map: Record<SaveState, { text: string; cls: string }> = {
    idle: { text: "Synced", cls: "text-slate-400" },
    dirty: { text: "Saving…", cls: "text-amber-300" },
    saving: { text: "Saving…", cls: "text-amber-300" },
    saved: { text: "Saved ✓", cls: "text-emerald-400" },
    error: { text: "Save failed — retrying", cls: "text-red-400" },
  };
  const s = map[state];
  return (
    <span className={`text-[11px] font-medium ${s.cls}`} role="status">
      {s.text}
    </span>
  );
}

const LANG_EXT: Record<string, string> = {
  javascript: "js",
  python: "py",
  java: "java",
  cpp: "cpp",
};

export function RoomWorkspace({
  room,
  problem: initialProblem,
  members,
  me,
  activeInterview,
}: RoomWorkspaceProps) {
  const {
    status,
    joinError,
    initialCode,
    initialLanguage,
    presence,
    messages,
    remoteTyping,
    remoteCode,
    remoteLanguage,
    me: socketMe,
    interviewEvent,
    submissionEvent,
    roomEvent,
    sendCodeChange,
    sendCodeRecordTick,
    sendCursorChange,
    sendLanguageChange,
    sendTyping,
    sendChatMessage,
  } = useRoomSocket(room.id);

  const [code, setCode] = useState(room.code);
  const [language, setLanguage] = useState(room.language);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [execState, setExecState] = useState<ExecState>({ kind: "idle" });
  const [execBusy, setExecBusy] = useState(false);
  // The problem is live-updatable (host can assign one mid-session).
  const [problem, setProblem] = useState<WorkspaceProblem>(initialProblem);

  const myUserId = socketMe?.userId ?? me.id;
  const applyingRemoteRef = useRef(false);

  // Apply the joined room state once.
  const appliedRef = useRef(false);
  useEffect(() => {
    if (
      status === "joined" &&
      initialCode !== null &&
      initialLanguage !== null &&
      !appliedRef.current
    ) {
      appliedRef.current = true;
      setCode(initialCode);
      setLanguage(initialLanguage);
    }
  }, [status, initialCode, initialLanguage]);

  // Apply remote code pushes (skip while we are the ones applying them).
  useEffect(() => {
    if (!remoteCode) return;
    applyingRemoteRef.current = true;
    setCode(remoteCode.code);
    const t = setTimeout(() => {
      applyingRemoteRef.current = false;
    }, 50);
    return () => clearTimeout(t);
  }, [remoteCode]);

  // Apply remote language pushes.
  useEffect(() => {
    if (!remoteLanguage) return;
    applyingRemoteRef.current = true;
    setLanguage(remoteLanguage.language);
    setCode(starterCodeFor(problem?.slug ?? null, remoteLanguage.language));
    const t = setTimeout(() => {
      applyingRemoteRef.current = false;
    }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteLanguage]);

  // Local edits → broadcast + autosave.
  const handleChange = useCallback(
    (v: string) => {
      if (applyingRemoteRef.current) return;
      setCode(v);
      sendCodeChange(v);
      sendCodeRecordTick(v, language);
      setSaveState("dirty");
    },
    [sendCodeChange, sendCodeRecordTick, language]
  );

  // Cursor broadcast (throttled).
  const lastCursorRef = useRef(0);
  const handleCursorChange = useCallback(
    (line: number, ch: number) => {
      const now = Date.now();
      if (now - lastCursorRef.current < 100) return;
      lastCursorRef.current = now;
      sendCursorChange(line, ch);
    },
    [sendCursorChange]
  );

  // Local language pick: swap starter code and tell everyone.
  function pickLanguage(next: string) {
    if (next === language) return;
    const currentStarter = starterCodeFor(problem?.slug ?? null, language);
    const pristine =
      code.trim() === "" || code.trim() === currentStarter.trim();
    if (
      !pristine &&
      !window.confirm(
        `Switch everyone to ${languageLabel(next)}? The editor will be replaced with ${languageLabel(next)} starter code.`
      )
    ) {
      return;
    }
    const starter = starterCodeFor(problem?.slug ?? null, next);
    setCode(starter);
    setLanguage(next);
    sendLanguageChange(next);
    sendCodeChange(starter);
  }

  // HTTP autosave fallback (also drives the Saved ✓ indicator; the socket
  // server coalesces its own DB flushes for late joiners).
  useEffect(() => {
    if (saveState !== "dirty") return;
    const t = setTimeout(async () => {
      setSaveState("saving");
      try {
        const res = await fetch(`/api/rooms/${room.id}/code`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, language }),
        });
        setSaveState(res.ok ? "saved" : "error");
      } catch {
        setSaveState("error");
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [code, language, saveState, room.id]);

  async function execute(mode: "run" | "submit") {
    if (execBusy || status !== "joined") return;
    setExecBusy(true);
    setExecState({ kind: "running", mode });
    try {
      const res = await fetch(`/api/rooms/${room.id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setExecState({
          kind: "error",
          message: data?.error ?? `Execution failed (HTTP ${res.status})`,
        });
        return;
      }
      setExecState({
        kind: "done",
        mode,
        verdict: data.verdict,
        passed: data.passed,
        total: data.total,
        runtimeMs: data.runtimeMs,
        results: data.results,
        stderr: data.stderr ?? "",
      });
    } catch {
      setExecState({ kind: "error", message: "Network error — is the server running?" });
    } finally {
      setExecBusy(false);
    }
  }

  // Live problem switch (host picked a new problem → room:update broadcast).
  // Everyone swaps to the new problem's starter code; the full statement is
  // fetched so the left panel shows it.
  const lastRoomSeqRef = useRef(0);
  useEffect(() => {
    if (!roomEvent || roomEvent.seq <= lastRoomSeqRef.current) return;
    lastRoomSeqRef.current = roomEvent.seq;
    if (!roomEvent.problem) {
      setProblem(null);
      return;
    }
    const slug = roomEvent.problem.slug;
    const starter = starterCodeFor(slug, language);
    setProblem((prev) => ({
      id: roomEvent.problem!.id,
      slug,
      title: roomEvent.problem!.title,
      difficulty: roomEvent.problem!.difficulty,
      description: prev?.description ?? "",
      examples: prev?.examples ?? [],
      constraints: prev?.constraints ?? [],
    }));
    setCode(starter);
    sendCodeChange(starter);
    fetch(`/api/rooms/${room.id}/problem`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.problem) setProblem(d.problem);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomEvent]);

  // Live submission results from other participants.
  const lastSubSeqRef = useRef(0);
  useEffect(() => {
    if (!submissionEvent || submissionEvent.seq <= lastSubSeqRef.current) return;
    lastSubSeqRef.current = submissionEvent.seq;
    if (submissionEvent.userId === myUserId) return; // my own result already shown
    setExecState({
        kind: "done",
        mode: "submit",
        verdict: submissionEvent.verdict,
        passed: submissionEvent.passed,
        total: submissionEvent.total,
        runtimeMs: submissionEvent.runtimeMs ?? 0,
        results: [],
        stderr: `Live result — ${submissionEvent.name} submitted (${submissionEvent.passed}/${submissionEvent.total} passed)`,
        liveFromOther: true,
      });
  }, [submissionEvent, myUserId]);

  async function handleChatSend(content: string): Promise<boolean> {
    const res = await sendChatMessage(content);
    return res.ok;
  }

  const fileName = `${problem ? problem.slug : "main"}.${LANG_EXT[language] ?? "txt"}`;
  const languageGradable = language === "javascript" || language === "python";

  if (status === "error") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-navy-950 text-center">
        <p className="text-lg font-semibold text-white">Couldn&apos;t join the room</p>
        <p className="max-w-sm text-sm text-slate-400">{joinError}</p>
        <Link href="/dashboard" className="btn-primary mt-2">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-navy-950">
      {/* ---------- Header ---------- */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-navy-900 px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href="/dashboard"
            aria-label="Back to dashboard"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-white">{room.name}</h1>
            <div className="mt-0.5 flex items-center gap-2">
              <CopyJoinCode code={room.joinCode} />
              <PresenceBar presence={presence} myUserId={myUserId} />
            </div>
          </div>
        </div>
        <div className="mx-2 flex min-w-0 flex-1 justify-center">
          <ProblemPicker
            roomId={room.id}
            isHost={me.role === "HOST"}
            current={problem ? { id: problem.id, slug: problem.slug, title: problem.title, difficulty: problem.difficulty } : null}
            roomEvent={roomEvent}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select
            aria-label="Language"
            value={language}
            onChange={(e) => pickLanguage(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-200 focus:outline-none"
          >
            {ROOM_LANGUAGES.map((l) => (
              <option key={l.value} value={l.value} className="bg-navy-800">
                {l.label}
              </option>
            ))}
          </select>
          <AiHint roomId={room.id} />
          <button
            type="button"
            onClick={() => execute("run")}
            disabled={execBusy || !problem || !languageGradable}
            title={!problem ? "No problem selected" : !languageGradable ? "Grading supports JavaScript & Python — switch language to grade" : "Run sample tests"}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
          >
            {execBusy ? "…" : "▶ Run"}
          </button>
          <button
            type="button"
            onClick={() => execute("submit")}
            disabled={execBusy || !problem || !languageGradable}
            title={!problem ? "No problem selected" : !languageGradable ? "Grading supports JavaScript & Python — switch language to grade" : "Grade against all tests"}
          	className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50"
          >
            Submit
          </button>
        </div>
      </header>

      <OutputPanel
        state={execState}
        onClose={() => setExecState({ kind: "idle" })}
      />

      {/* ---------- Interview controls (host) ---------- */}
      <InterviewPanel
        roomId={room.id}
        isHost={me.role === "HOST"}
        members={members.map((m) => ({
          userId: m.user.id,
          name: m.user.name,
          role: m.role,
        }))}
        activeInterview={activeInterview}
        interviewEvent={interviewEvent}
      />

      {/* ---------- Panels ---------- */}
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[340px] shrink-0 overflow-y-auto border-r border-white/10 bg-navy-900 lg:block">
          <ProblemPanel problem={problem} />
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-white/10 bg-navy-900 px-3">
            <span className="font-mono text-[11px] text-slate-400">{fileName}</span>
            <div className="flex items-center gap-3">
              {status === "connecting" && (
                <span className="text-[11px] text-amber-300">Connecting…</span>
              )}
              {status === "joined" && presence.length > 1 && (
                <span className="text-[11px] text-emerald-400">Live · {presence.length} online</span>
              )}
              <SaveIndicator state={saveState} />
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <CodeEditor
              value={code}
              language={MONACO_LANGUAGE[language as keyof typeof MONACO_LANGUAGE] ?? "javascript"}
              onChange={handleChange}
              onCursorChange={handleCursorChange}
              remoteCursors={presence
                .filter((p) => p.userId !== myUserId && p.cursor)
                .map((p) => ({
                  userId: p.userId,
                  name: p.name,
                  color: p.color,
                  cursor: p.cursor ? { line: p.cursor.line, ch: p.cursor.ch } : null,
                }))}
            />
          </div>
        </section>

        <aside className="hidden w-[300px] shrink-0 flex-col border-l border-white/10 bg-navy-900 xl:flex">
          <div className="flex h-8 shrink-0 items-center border-b border-white/10 px-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Chat
            </span>
          </div>
          <ChatPanel
            messages={messages}
            remoteTyping={remoteTyping}
            myUserId={myUserId}
            disabled={status !== "joined"}
            onSend={handleChatSend}
            onTyping={sendTyping}
          />
        </aside>
      </div>

      <p className="border-t border-white/10 bg-navy-950 px-4 py-1.5 text-center text-[11px] text-slate-500 lg:hidden">
        Best on a wider screen — problem and chat panels appear on large viewports.
      </p>
    </div>
  );
}
