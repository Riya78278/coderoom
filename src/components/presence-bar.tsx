"use client";

import type { PresenceUser } from "@/hooks/use-room-socket";

function initialsOf(name: string) {
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export function PresenceBar({
  presence,
  myUserId,
}: {
  presence: PresenceUser[];
  myUserId: string;
}) {
  return (
    <div className="flex items-center">
      {presence.slice(0, 5).map((p, i) => (
        <span
          key={p.userId}
          title={`${p.name}${p.userId === myUserId ? " (you)" : ""}`}
          style={{
            background: `linear-gradient(135deg, ${p.color}, ${p.color}99)`,
            zIndex: presence.length - i,
          }}
          className="relative -ml-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-navy-900 text-[10px] font-bold text-navy-950 first:ml-0"
        >
          {initialsOf(p.name)}
        </span>
      ))}
      {presence.length > 5 && (
        <span className="relative -ml-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-navy-900 bg-white/10 text-[10px] font-bold text-slate-200">
          +{presence.length - 5}
        </span>
      )}
    </div>
  );
}
