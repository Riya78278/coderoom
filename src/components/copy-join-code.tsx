"use client";

import { useState } from "react";

/** Mono join code with a copy-to-clipboard button. */
export function CopyJoinCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const display = `${code.slice(0, 3)}-${code.slice(3)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permissions/insecure context) — user can
      // still select the text manually since it's rendered as text.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy join code"
      className="group inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 transition hover:border-indigo-300 hover:bg-indigo-50"
    >
      <span className="font-mono text-sm font-semibold tracking-widest text-slate-700">
        {display}
      </span>
      <span
        className={`text-xs font-semibold transition ${
          copied ? "text-emerald-600" : "text-slate-400 group-hover:text-indigo-600"
        }`}
      >
        {copied ? "Copied ✓" : "Copy"}
      </span>
    </button>
  );
}
