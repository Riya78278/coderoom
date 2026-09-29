"use client";

import { useEffect } from "react";

export type CaseResultView = {
  index: number;
  isSample: boolean;
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
  error: string | null;
  skipped?: boolean;
};

export type ExecState =
  | { kind: "idle" }
  | { kind: "running"; mode: "run" | "submit" }
  | { kind: "done"; mode: "run" | "submit"; verdict: string; passed: number; total: number; runtimeMs: number; results: CaseResultView[]; stderr: string }
  | { kind: "error"; message: string };

const VERDICT_STYLES: Record<string, { label: string; cls: string }> = {
  ACCEPTED: { label: "Accepted", cls: "bg-emerald-500/15 text-emerald-300" },
  WRONG_ANSWER: { label: "Wrong Answer", cls: "bg-red-500/15 text-red-300" },
  RUNTIME_ERROR: { label: "Runtime Error", cls: "bg-amber-500/15 text-amber-300" },
  TLE: { label: "Time Limit Exceeded", cls: "bg-orange-500/15 text-orange-300" },
  COMPILE_ERROR: { label: "Compile Error", cls: "bg-red-500/15 text-red-300" },
  UNSUPPORTED: { label: "Not gradable yet", cls: "bg-slate-500/15 text-slate-300" },
};

function CaseRow({ r }: { r: CaseResultView }) {
  const icon = r.skipped ? "–" : r.passed ? "✓" : "✗";
  const iconCls = r.skipped
    ? "text-slate-500"
    : r.passed
      ? "text-emerald-400"
      : "text-red-400";
  return (
    <div className="rounded-xl bg-white/5 p-3 text-xs">
      <div className="flex items-center gap-2">
        <span className={`font-bold ${iconCls}`}>{icon}</span>
        <span className="font-semibold text-slate-200">
          Case {r.index + 1}
          {!r.isSample && " (hidden)"}
        </span>
        {r.error && (
          <span className="badge bg-red-500/15 text-red-300">{r.error}</span>
        )}
      </div>
      {r.isSample && r.input && (
        <pre className="mt-1.5 overflow-x-auto font-mono text-[11px] text-slate-400">
Input: {r.input}
        </pre>
      )}
      {r.isSample && (
        <pre className="mt-1 overflow-x-auto font-mono text-[11px] text-slate-300 whitespace-pre-wrap">
          {r.passed
            ? `Output: ${r.actual || r.expected}`
            : `Expected: ${r.expected}\nYours: ${r.actual || "—"}`}
        </pre>
      )}
    </div>
  );
}

export function OutputPanel({
  state,
  onClose,
}: {
  state: ExecState;
  onClose: () => void;
}) {
  useEffect(() => {
    if (state.kind === "done" || state.kind === "error") {
      // auto-scroll into view handled by parent layout
    }
  }, [state]);

  if (state.kind === "idle") return null;

  return (
    <div className="border-t border-white/10 bg-navy-900">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {state.kind === "running"
              ? state.mode === "run" ? "Running samples…" : "Submitting…"
              : "Results"}
          </span>
          {state.kind === "done" && (
            <>
              <span
                className={`badge ${
                  VERDICT_STYLES[state.verdict]?.cls ?? "bg-slate-500/15 text-slate-300"
                }`}
              >
                {VERDICT_STYLES[state.verdict]?.label ?? state.verdict}
              </span>
              <span className="text-xs text-slate-400">
                {state.passed}/{state.total} passed · {state.runtimeMs} ms
              </span>
            </>
          )}
          {state.kind === "error" && (
            <span className="badge bg-red-500/15 text-red-300">Error</span>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close results"
          className="text-slate-500 transition hover:text-slate-200"
        >
          ✕
        </button>
      </div>

      <div className="max-h-56 overflow-y-auto px-4 pb-3">
        {state.kind === "running" && (
          <p className="text-xs text-slate-400">
            Executing in sandbox… (one run per test case)
          </p>
        )}
        {state.kind === "error" && (
          <p className="text-xs text-red-300">{state.message}</p>
        )}
        {state.kind === "done" && (
          <>
            {state.stderr && (
              <pre className="mb-2 rounded-lg bg-red-500/10 p-2 font-mono text-[11px] text-red-300 whitespace-pre-wrap">
                {state.stderr}
              </pre>
            )}
            <div className="space-y-2">
              {state.results.map((r) => (
                <CaseRow key={r.index} r={r} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
