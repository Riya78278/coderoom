"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  roomId: string | null;
  actorName: string | null;
  readAt: string | null;
  createdAt: string;
};

const TYPE_STYLES: Record<string, string> = {
  JOIN: "bg-emerald-500/15 text-emerald-600",
  CHAT: "bg-sky-500/15 text-sky-600",
  INTERVIEW: "bg-indigo-500/15 text-indigo-600",
  PROBLEM: "bg-amber-500/15 text-amber-600",
};

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setUnread(data.unread ?? 0);
      setItems(data.latest ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    void load();
    // Live push via the same Socket.IO server (user:<id> channel).
    const socket = io({ path: "/api/socketio", addTrailingSlash: false });
    socket.on("notification", () => void load());
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [load]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function markAll() {
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markRead: "all" }),
    });
  }

  function clickItem(n: Notification) {
    void fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markRead: "one", id: n.id }),
    });
    if (n.roomId) router.push(`/room/${n.roomId}`);
    setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          void load();
        }}
        aria-label="Notifications"
        className="relative rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.85 23.85 0 0 0 5.454-1.31A8.97 8.97 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.97 8.97 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.26 24.26 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-white/10 bg-navy-800 p-3 shadow-2xl">
          <div className="flex items-center justify-between px-1 pb-2">
            <p className="text-xs font-semibold text-slate-200">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-[11px] text-indigo-300 hover:text-indigo-200">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {loading && <p className="px-1 py-3 text-[11px] text-slate-500">Loading…</p>}
            {!loading && items.length === 0 && (
              <p className="px-1 py-3 text-[11px] text-slate-500">
                Nothing yet — joins, chats, and interview events land here.
              </p>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => clickItem(n)}
                className={`flex w-full items-start gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-white/5 ${
                  n.readAt ? "opacity-60" : ""
                }`}
              >
                <span
                  className={`mt-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                    TYPE_STYLES[n.type] ?? "bg-slate-500/15 text-slate-400"
                  }`}
                >
                  {n.type}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-medium text-slate-200">
                    {n.title}
                  </span>
                  {n.body && (
                    <span className="block truncate text-[10px] text-slate-500">{n.body}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
