import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSessionPayload } from "@/lib/session";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Interview History — CodeRoom",
};

export const dynamic = "force-dynamic";

function durationOf(startedAt: Date, endedAt: Date | null) {
  if (!endedAt) return "in progress";
  const mins = Math.max(1, Math.round((+endedAt - +startedAt) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m`;
}

export default async function InterviewsPage() {
  const session = await getSessionPayload();
  if (!session) redirect("/login?next=/dashboard/interviews");

  const interviews = await db.interview.findMany({
    where: {
      OR: [{ interviewerId: session.id }, { candidateId: session.id }],
    },
    orderBy: { startedAt: "desc" },
    take: 100,
    include: {
      room: { select: { id: true, name: true, status: true } },
      problem: { select: { title: true, difficulty: true } },
      interviewer: { select: { id: true, name: true } },
      candidate: { select: { id: true, name: true } },
    },
  });

  const completed = interviews.filter((i) => i.status === "COMPLETED");

  return (
    <DashboardShell user={session}>
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Interview History
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Mock interviews you hosted or took — with duration, problem, and review.
            </p>
          </div>
          <div className="flex gap-3">
            <span className="card px-4 py-2 text-sm">
              <span className="font-bold text-slate-900">{interviews.length}</span>{" "}
              <span className="text-slate-500">sessions</span>
            </span>
            <span className="card px-4 py-2 text-sm">
              <span className="font-bold text-slate-900">{completed.length}</span>{" "}
              <span className="text-slate-500">completed</span>
            </span>
          </div>
        </div>

        {interviews.length === 0 ? (
          <div className="card mt-8 flex flex-col items-center gap-3 p-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-2xl">
              🎙️
            </span>
            <h3 className="font-semibold text-slate-900">No interviews yet</h3>
            <p className="max-w-sm text-sm text-slate-600">
              In an active room, the host can press “Start interview session”.
              Finished sessions appear here with duration, problem, and feedback.
            </p>
            <Link href="/dashboard" className="btn-primary mt-1">
              Go to dashboard
            </Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {interviews.map((iv) => {
              const wasInterviewer = iv.interviewerId === session.id;
              return (
                <li key={iv.id} className="card p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/dashboard/interviews/${iv.id}`}
                      className="min-w-0 flex-1 basis-56"
                    >
                      <p className="font-semibold text-slate-900 hover:text-indigo-600">
                        {iv.room.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {wasInterviewer ? "You interviewed " : "Interviewed by "}
                        {wasInterviewer ? iv.candidate.name : iv.interviewer.name}
                        {iv.problem ? ` · ${iv.problem.title}` : " · no problem"}
                        {` · ${durationOf(iv.startedAt, iv.endedAt)}`}
                        {iv.rating ? ` · ${"★".repeat(iv.rating)}${"☆".repeat(5 - iv.rating)}` : ""}
                      </p>
                    </Link>
                    <span
                      className={`badge ${
                        iv.status === "COMPLETED"
                          ? "bg-slate-100 text-slate-600"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {iv.status === "COMPLETED" ? "Completed" : "● Live"}
                    </span>
                    <Link
                      href={`/dashboard/interviews/${iv.id}`}
                      className="text-sm font-semibold text-indigo-600 hover:text-indigo-500"
                    >
                      Open →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DashboardShell>
  );
}
