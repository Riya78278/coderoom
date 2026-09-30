import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { ReplayPlayer } from "@/components/replay-player";
import { getSessionPayload } from "@/lib/session";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Replay — CodeRoom",
};

export const dynamic = "force-dynamic";

export default async function ReplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionPayload();
  if (!session) redirect("/login");

  const { id } = await params;

  const membership = await db.roomMember.findUnique({
    where: { roomId_userId: { roomId: id, userId: session.id } },
    select: { id: true },
  });
  if (!membership) notFound();

  const room = await db.room.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!room) notFound();

  return (
    <DashboardShell user={session}>
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8">
        <Link
          href={`/dashboard/interviews`}
          className="text-sm font-medium text-slate-500 transition hover:text-slate-800"
        >
          ← Interviews
        </Link>

        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
          Replay: {room.name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Watch how the code evolved — typing, chat, submissions, and interview
          milestones, oldest to newest.
        </p>

        <div className="mt-6">
          <ReplayPlayer roomId={room.id} />
        </div>
      </div>
    </DashboardShell>
  );
}
