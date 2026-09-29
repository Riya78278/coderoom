import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSessionPayload } from "@/lib/session";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Interview — CodeRoom",
};

export const dynamic = "force-dynamic";

const LANGUAGE_LABELS: Record<string, string> = {
  javascript: "JavaScript",
  python: "Python",
  java: "Java",
  cpp: "C++",
};

export default async function InterviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionPayload();
  if (!session) redirect("/login");

  const { id } = await params;

  const interview = await db.interview.findUnique({
    where: { id },
    include: {
      room: { select: { id: true, name: true, status: true } },
      problem: { select: { title: true, difficulty: true } },
      interviewer: { select: { id: true, name: true, email: true } },
      candidate: { select: { id: true, name: true, email: true } },
      snapshots: {
        orderBy: { takenAt: "asc" },
        select: {
          id: true,
          userId: true,
          user: { select: { name: true } },
          code: true,
          language: true,
          takenAt: true,
        },
      },
    },
  });

  if (
    !interview ||
    (interview.interviewerId !== session.id && interview.candidateId !== session.id)
  ) {
    notFound();
  }

  const duration =
    interview.endedAt
      ? Math.max(1, Math.round((+interview.endedAt - +interview.startedAt) / 60000))
      : null;

  return (
    <DashboardShell user={session}>
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8">
        <Link
          href="/dashboard/interviews"
          className="text-sm font-medium text-slate-500 transition hover:text-slate-800"
        >
          ← All interviews
        </Link>

        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
          {interview.room.name}
        </h1>

        {/* Summary strip */}
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="card p-4">
            <p className="text-xs font-medium text-slate-500">Duration</p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {duration ? `${duration} min` : "In progress"}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-medium text-slate-500">Problem</p>
            <p className="mt-1 truncate text-lg font-bold text-slate-900">
              {interview.problem?.title ?? "—"}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-medium text-slate-500">Rating</p>
            <p className="mt-1 text-lg font-bold text-amber-500">
              {interview.rating
                ? "★".repeat(interview.rating) + "☆".repeat(5 - interview.rating)
                : "—"}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-medium text-slate-500">Snapshots</p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {interview.snapshots.length}
            </p>
          </div>
        </div>

        {/* Participants */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Participants
          </h2>
          <div className="card mt-2 grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-slate-500">Interviewer</p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {interview.interviewer.name}
                {interview.interviewer.id === session.id && (
                  <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Candidate</p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {interview.candidate.name}
                {interview.candidate.id === session.id && (
                  <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>
                )}
              </p>
            </div>
          </div>
        </section>

        {/* Feedback */}
        {interview.feedback && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Feedback
            </h2>
            <div className="card mt-2 p-5">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {interview.feedback}
              </p>
            </div>
          </section>
        )}

        {/* Code snapshots */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Code snapshots
          </h2>
          {interview.snapshots.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              No snapshots were taken in this session.
            </p>
          ) : (
            <div className="mt-2 space-y-4">
              {interview.snapshots.map((s) => (
                <div key={s.id} className="card overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2">
                    <span className="text-xs font-semibold text-slate-600">
                      {s.user.name} · {LANGUAGE_LABELS[s.language] ?? s.language}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(s.takenAt).toLocaleString()}
                    </span>
                  </div>
                  <pre className="max-h-96 overflow-auto bg-navy-950 p-4 font-mono text-xs leading-relaxed text-slate-200">
                    {s.code}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
