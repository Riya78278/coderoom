"use client";

import { useState } from "react";

export function AiHint({ roomId }: { roomId: string }) {
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      const res = await fetch("/api/ai/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "AI request failed.");
        return;
      }
      setHint(data.hint ?? "");
      setOpen(true);
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={ask}
        disabled={busy}
        title="Ask the AI coach for a hint"
        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
      >
        {busy ? "…" : "✨ Hint"}
      </button>

      {open && (hint || error) && (
        <div className="absolute right-0 top-11 z-40 w-[min(420px,88vw)] rounded-2xl border border-white/10 bg-navy-800 p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-slate-200">AI Coach</p>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close hint"
              className="text-slate-500 transition hover:text-slate-200"
            >
              ✕
            </button>
          </div>
          {error ? (
            <p className="mt-2 text-[11px] text-red-300">{error}</p>
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300">
              {hint}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
