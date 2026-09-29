import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { RoomDialogs } from "@/components/room-dialogs";
import { CopyJoinCode } from "@/components/copy-join-code";
import { getSessionPayload } from "@/lib/session";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Dashboard — CodeRoom",
};

export const dynamic = "force-dynamic";

const DIFFICULTY_STYLES: Record<string, string> = {
  EASY: "bg-emerald-50 text-emerald-700",
  MEDIUM: "bg-amber-50 text-amber-700",
  HARD: "bg-red-50 text-red-700",
};

export default async function DashboardPage() {
  const session = await getSessionPayload();
  if (!session) redirect("/login?next=/dashboard");

  const [problems, memberships] = await Promise.all([
    db.problem.findMany({
      orderBy: [{ difficulty: "asc" }, { title: "asc" }],
      select: { id: true, title: true, difficulty: true },
    }),
    db.roomMember.findMany({
      where: { userId: session.id },
      orderBy: { room: { updatedAt: "desc" } },
      select: {
        role: true,
        room: {
          include: {
            problem: { select: { id: true, title: true, difficulty: true } },
            _count: { select: { members: true } },
          },
        },
      },
    }),
  ]);

  const rooms = memberships
    .map((m) => ({ ...m.room, myRole: m.role, memberCount: m.room._count.members }))
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));

  const firstName = session.name.split(" ")[0];
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <DashboardShell user={session}>
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8">
        {/* ---------- Header ---------- */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {greeting}, {firstName} 👋
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Ready to code together? Create a room or join one with a code.
            </p>
          </div>
          <RoomDialogs problems={problems} />
        </div>

        {/* ---------- Stats ---------- */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="card p-5">
            <p className="text-sm font-medium text-slate-600">Your Rooms</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              {rooms.length}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {rooms.filter((r) => r.status === "ACTIVE").length} active
            </p>
          </div>
          <div className="card p-5">
            <p className="text-sm font-medium text-slate-600">Rooms Hosted</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              {rooms.filter((r) => r.myRole === "HOST").length}
            </p>
            <p className="mt-1 text-xs text-slate-400">Rooms you created</p>
          </div>
          <div className="card p-5">
            <p className="text-sm font-medium text-slate-600">Problems in Library</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              {problems.length}
            </p>
            <p className="mt-1 text-xs text-slate-400">Available when creating a room</p>
          </div>
        </div>

        {/* ---------- Recent rooms ---------- */}
        <div className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              Recent Rooms
            </h2>
            <span className="text-xs font-medium text-slate-400">
              {rooms.length} total
            </span>
          </div>

          {rooms.length === 0 ? (
            <div className="mt-4 card flex flex-col items-center gap-3 p-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-2xl">
                🚪
              </span>
              <h3 className="font-semibold text-slate-900">No rooms yet</h3>
              <p className="max-w-sm text-sm text-slate-600">
                Create a room and share its code, or join a friend&apos;s room with
                the 6-character code they share with you.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {rooms.map((room) => (
                <li key={room.id} className="card p-4 transition hover:border-slate-300">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/room/${room.id}`}
                      className="min-w-0 flex-1 basis-56 font-semibold text-slate-900 hover:text-indigo-600"
                    >
                      {room.name}
                    </Link>

                    <span
                      className={`badge ${
                        room.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {room.status === "ACTIVE" ? "● Active" : "○ Completed"}
                    </span>
                    {room.myRole === "HOST" && (
                      <span className="badge bg-indigo-50 text-indigo-700">Host</span>
                    )}
                    <span className="badge bg-slate-100 text-slate-600">
                      {room.memberCount} {room.memberCount === 1 ? "member" : "members"}
                    </span>

                    <CopyJoinCode code={room.joinCode} />

                    <Link
                      href={`/room/${room.id}`}
                      className="text-sm font-semibold text-indigo-600 hover:text-indigo-500"
                    >
                      Open →
                    </Link>
                  </div>

                  <p className="mt-1.5 text-xs text-slate-500">
                    {room.problem
                      ? `Problem: ${room.problem.title} · ${
                          room.problem.difficulty.toLowerCase()
                        } — `
                      : "No problem selected — "}
                    started {new Date(room.createdAt).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
