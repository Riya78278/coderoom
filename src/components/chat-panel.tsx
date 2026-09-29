"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/hooks/use-room-socket";

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatPanel({
  messages,
  remoteTyping,
  myUserId,
  disabled,
  onSend,
  onTyping,
}: {
  messages: ChatMessage[];
  remoteTyping: Record<string, { name: string; at: number }>;
  myUserId: string;
  disabled: boolean;
  onSend: (content: string) => Promise<boolean>;
  onTyping?: (typing: boolean) => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, remoteTyping]);

  const typingNames = Object.values(remoteTyping)
    .map((t) => t.name)
    .slice(0, 2);
  const typingLabel =
    typingNames.length === 0
      ? null
      : typingNames.length === 1
        ? `${typingNames[0]} is typing…`
        : `${typingNames.join(" and ")} are typing…`;

  const lastTypingRef = useRef(0);
  function handleDraft(v: string) {
    setDraft(v);
    if (!onTyping) return;
    const now = Date.now();
    if (now - lastTypingRef.current > 800) {
      lastTypingRef.current = now;
      onTyping(true);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending || disabled) return;
    setSending(true);
    setDraft("");
    const ok = await onSend(content);
    if (!ok) setDraft(content); // restore on failure
    setSending(false);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3"
      >
        {messages.length === 0 && (
          <p className="px-1 text-xs text-slate-500">
            No messages yet — say hello 👋
          </p>
        )}
        {messages.map((m) => {
          const mine = m.userId === myUserId;
          return (
            <div key={m.id} className={mine ? "text-right" : "text-left"}>
              {!mine && (
                <p className="mb-0.5 text-[11px] font-semibold text-slate-400">
                  {m.name}
                </p>
              )}
              <div
                className={`inline-block max-w-[85%] rounded-2xl px-3 py-1.5 text-sm leading-snug ${
                  mine
                    ? "bg-indigo-600 text-white"
                    : "bg-white/10 text-slate-100"
                }`}
              >
                {m.content}
              </div>
              <p className="mt-0.5 text-[10px] text-slate-500">
                {timeOf(m.createdAt)}
              </p>
            </div>
          );
        })}
        {typingLabel && (
          <p className="px-1 text-[11px] italic text-slate-400">{typingLabel}</p>
        )}
      </div>

      <form onSubmit={submit} className="border-t border-white/10 p-3">
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
            placeholder={disabled ? "Connecting…" : "Type a message…"}
            value={draft}
            onChange={(e) => handleDraft(e.target.value)}
            disabled={disabled}
            maxLength={2000}
          />
          <button
            type="submit"
            disabled={disabled || sending || !draft.trim()}
            className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
