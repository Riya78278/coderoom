import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RoomWorkspace } from "@/components/room-workspace";
import { getSessionPayload } from "@/lib/session";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Room — CodeRoom",
};

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionPayload();
  if (!session) redirect("/login");

  const { id } = await params;

  const membership = await db.roomMember.findUnique({
    where: { roomId_userId: { roomId: id, userId: session.id } },
    select: { role: true },
  });
  if (!membership) notFound();

  const room = await db.room.findUnique({
    where: { id },
    include: {
      problem: true,
      members: {
        orderBy: { joinedAt: "asc" },
        select: {
          id: true,
          role: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  if (!room) notFound();

  const activeInterview = await db.interview.findFirst({
    where: { roomId: id, status: "ACTIVE" },
    select: {
      id: true,
      interviewerId: true,
      candidateId: true,
      startedAt: true,
    },
  });

  return (
    <RoomWorkspace
      room={{
        id: room.id,
        name: room.name,
        joinCode: room.joinCode,
        language: room.language,
        code: room.code,
        status: room.status,
      }}
      problem={
        room.problem
          ? {
              id: room.problem.id,
              slug: room.problem.slug,
              title: room.problem.title,
              difficulty: room.problem.difficulty,
              description: room.problem.description,
              examples: room.problem.examples,
              constraints: room.problem.constraints,
            }
          : null
      }
      members={room.members}
      me={{
        id: session.id,
        name: session.name,
        role: membership.role,
      }}
      activeInterview={
        activeInterview
          ? {
              id: activeInterview.id,
              interviewerId: activeInterview.interviewerId,
              candidateId: activeInterview.candidateId,
              startedAt: activeInterview.startedAt.toISOString(),
            }
          : null
      }
    />
  );
}
