/**
 * Presentational fake editor for the landing hero — shows two collaborators
 * with live cursors, which is exactly what CodeRoom enables for real.
 */
const CURSORS = [
  { name: "Riya", line: 3, color: "bg-indigo-500", flag: "bg-indigo-500" },
  { name: "Rahul", line: 6, color: "bg-emerald-500", flag: "bg-emerald-500" },
] as const;

const LINES = [
  <>
    <span className="text-slate-500">// Two Sum — hash map approach</span>
  </>,
  <>
    <span className="text-fuchsia-400">function</span>{" "}
    <span className="text-sky-300">twoSum</span>
    <span className="text-slate-300">(nums, target) {"{"}</span>
  </>,
  <>
    {"  "}
    <span className="text-fuchsia-400">const</span>{" "}
    <span className="text-slate-300">seen = </span>
    <span className="text-fuchsia-400">new</span>{" "}
    <span className="text-amber-300">Map</span>
    <span className="text-slate-300">();</span>
  </>,
  <>
    {"  "}
    <span className="text-fuchsia-400">for</span>{" "}
    <span className="text-slate-300">(</span>
    <span className="text-fuchsia-400">let</span>{" "}
    <span className="text-slate-300">i = 0; i {"<"} nums.</span>
    <span className="text-sky-300">length</span>
    <span className="text-slate-300">; i++) {"{"}</span>
  </>,
  <>
    {"    "}
    <span className="text-fuchsia-400">const</span>{" "}
    <span className="text-slate-300">need = target - nums[i];</span>
  </>,
  <>
    {"    "}
    <span className="text-fuchsia-400">if</span>{" "}
    <span className="text-slate-300">(seen.</span>
    <span className="text-sky-300">has</span>
    <span className="text-slate-300">(need)) </span>
    <span className="text-fuchsia-400">return</span>{" "}
    <span className="text-slate-300">[seen.</span>
    <span className="text-sky-300">get</span>
    <span className="text-slate-300">(need), i];</span>
  </>,
  <>
    {"    "}
    <span className="text-slate-300">seen.</span>
    <span className="text-sky-300">set</span>
    <span className="text-slate-300">(nums[i], i);</span>
  </>,
  <>
    {"  "}
    <span className="text-slate-300">{"}"}</span>
  </>,
  <>
    <span className="text-slate-300">{"}"}</span>
  </>,
];

export function EditorMock() {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-slate-700/60 bg-navy-900 shadow-2xl shadow-indigo-950/40 ring-1 ring-white/10">
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-white/5 bg-navy-950/80 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-rose-500/90" />
        <span className="h-3 w-3 rounded-full bg-amber-400/90" />
        <span className="h-3 w-3 rounded-full bg-emerald-400/90" />
        <span className="ml-3 rounded-md bg-white/5 px-2.5 py-1 font-mono text-[11px] text-slate-400">
          room/amazon-interview-42 · main.js
        </span>
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          Live · 2 participants
        </span>
      </div>

      {/* code */}
      <div className="relative px-4 py-4 font-mono text-[13px] leading-6">
        {LINES.map((line, i) => (
          <div key={i} className="flex">
            <span className="w-7 shrink-0 text-right text-slate-600 select-none">
              {i + 1}
            </span>
            <span className="pl-4 whitespace-pre text-slate-300">{line}</span>
            {CURSORS.map((c) =>
              c.line === i + 1 ? (
                <span
                  key={c.name}
                  className={`relative ml-0.5 inline-block h-5 w-[2px] ${c.color}`}
                >
                  <span
                    className={`absolute -top-4 left-0 rounded px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-white ${c.flag}`}
                  >
                    {c.name}
                  </span>
                </span>
              ) : null
            )}
          </div>
        ))}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy-900 via-transparent to-transparent" />
      </div>

      {/* chat teaser */}
      <div className="flex items-center gap-3 border-t border-white/5 bg-navy-950/60 px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-bold text-emerald-300">
          R
        </span>
        <p className="text-xs text-slate-400">
          <span className="font-semibold text-slate-200">Rahul:</span>{" "}
          hashmap looks good — O(n) time 👍
        </p>
        <span className="ml-auto text-[11px] text-slate-500">12:42</span>
      </div>
    </div>
  );
}
