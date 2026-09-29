type ProblemExample = { input?: string; output?: string; explanation?: string };

export type ProblemPanelData = {
  title: string;
  difficulty: string;
  description: string;
  examples?: unknown;
  constraints: string[];
};

const DIFFICULTY_STYLES: Record<string, string> = {
  EASY: "bg-emerald-500/15 text-emerald-300",
  MEDIUM: "bg-amber-500/15 text-amber-300",
  HARD: "bg-red-500/15 text-red-300",
};

/** Left panel of the room workspace — the problem statement. */
export function ProblemPanel({ problem }: { problem: ProblemPanelData | null }) {
  if (!problem) {
    return (
      <div className="p-5">
        <p className="text-sm text-slate-400">
          No problem selected — this room starts with a blank editor. Pick a
          problem next time you create a room.
        </p>
      </div>
    );
  }

  const examples = Array.isArray(problem.examples)
    ? (problem.examples as ProblemExample[])
    : [];

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-white">{problem.title}</h2>
        <span
          className={`badge ${
            DIFFICULTY_STYLES[problem.difficulty] ?? "bg-slate-500/15 text-slate-300"
          }`}
        >
          {problem.difficulty.toLowerCase()}
        </span>
      </div>

      <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-300">
        {problem.description.split("\n\n").map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>

      {examples.length > 0 && (
        <div className="mt-5 space-y-3">
          {examples.map((ex, i) => (
            <div key={i} className="rounded-xl bg-white/5 p-3 text-xs">
              <p className="font-semibold text-slate-200">Example {i + 1}</p>
              {ex.input && (
                <pre className="mt-1.5 overflow-x-auto font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap">
Input: {ex.input}
                  {ex.output && `\nOutput: ${ex.output}`}
                  {ex.explanation && `\nExplanation: ${ex.explanation}`}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}

      {problem.constraints.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Constraints
          </p>
          <ul className="mt-2 space-y-1 text-xs text-slate-300">
            {problem.constraints.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-slate-500">•</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
