import Link from "next/link";
import { Logo } from "@/components/logo";
import { EditorMock } from "@/components/editor-mock";
import { getSessionPayload } from "@/lib/session";

const FEATURES = [
  {
    title: "Real-time collaboration",
    body: "Share a room, and every keystroke reaches your partner instantly — no refresh, no merge conflicts.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5M16.5 3 21 7.5m0 0L16.5 12M21 7.5H7.5"
      />
    ),
  },
  {
    title: "Live chat & cursors",
    body: "Discuss the approach in chat while named cursors show exactly where each person is in the code.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
      />
    ),
  },
  {
    title: "Run & test (coming soon)",
    body: "Execute code against sample and hidden test cases in isolated sandboxes — safely graded for everyone in the room.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m5.25 4.5 7.5 7.5-7.5 7.5m6-15 7.5 7.5-7.5 7.5"
      />
    ),
  },
  {
    title: "Mock interviews & history",
    body: "Interviewer and candidate roles, session timers, and a replayable history of every room you run.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    ),
  },
];

const STEPS = [
  {
    n: "1",
    title: "Create a room",
    body: "Pick a name, language, and problem. You get a 6-character join code to share.",
  },
  {
    n: "2",
    title: "Invite your partner",
    body: "They enter the code and appear in the room with their own named cursor.",
  },
  {
    n: "3",
    title: "Solve it together",
    body: "Code, chat, and run tests live. Every session is saved to your history.",
  },
];

export default async function LandingPage() {
  const session = await getSessionPayload();

  return (
    <div className="flex min-h-screen flex-col">
      {/* ---------- Navbar ---------- */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="transition hover:text-slate-900">
              Features
            </a>
            <a href="#how" className="transition hover:text-slate-900">
              How it works
            </a>
          </nav>
          <div className="flex items-center gap-3">
            {session ? (
              <Link href="/dashboard" className="btn-primary">
                Open dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden text-sm font-semibold text-slate-700 transition hover:text-indigo-600 sm:block"
                >
                  Sign in
                </Link>
                <Link href="/register" className="btn-primary">
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ---------- Hero ---------- */}
        <section className="relative overflow-hidden bg-navy-950 text-white">
          <div className="glow-grid absolute inset-0" />
          <div className="code-grid absolute inset-0 opacity-60" />
          <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-28">
            <div>
              <span className="badge border border-indigo-400/30 bg-indigo-400/10 text-indigo-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Real-time pair programming
              </span>
              <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Code together.
                <br />
                <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-300 bg-clip-text text-transparent">
                  Build better.
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
                CodeRoom is a collaborative coding platform for real-time
                interviews and pair programming — shared editor, live cursors,
                instant chat, and session history that remembers everything.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href={session ? "/dashboard" : "/register"}
                  className="btn-primary px-6 py-3 text-base"
                >
                  Create your first room →
                </Link>
                <Link
                  href={session ? "/dashboard" : "/login"}
                  className="btn-ghost-dark px-6 py-3 text-base"
                >
                  {session ? "Go to dashboard" : "I already have an account"}
                </Link>
              </div>
              <p className="mt-4 text-sm text-slate-400">
                Free to use · No credit card · Works in your browser
              </p>
            </div>
            <div className="relative">
              <EditorMock />
            </div>
          </div>
        </section>

        {/* ---------- Features ---------- */}
        <section id="features" className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Everything a coding session needs
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
            Built for mock interviews, pair programming, and teaching — one
            room has it all.
          </p>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="card group p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200"
              >
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5.5 w-5.5"
                    aria-hidden="true"
                  >
                    {f.icon}
                  </svg>
                </span>
                <h3 className="font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section id="how" className="border-y border-slate-200 bg-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              Three steps to your first session
            </h2>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n} className="relative text-center md:text-left">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-md shadow-indigo-600/25">
                    {s.n}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {s.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- CTA ---------- */}
        <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <div className="glow-grid relative overflow-hidden rounded-3xl px-6 py-14 text-center text-white sm:px-12">
            <div className="code-grid absolute inset-0 opacity-50" />
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Your next interview starts in a room.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-slate-300">
                Create one, share the code, and start collaborating in under a
                minute.
              </p>
              <Link
                href={session ? "/dashboard" : "/register"}
                className="btn-primary mt-8 px-8 py-3 text-base"
              >
                Get started free
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6">
          <Logo />
          <p>© {new Date().getFullYear()} CodeRoom. Built for collaborative coding.</p>
        </div>
      </footer>
    </div>
  );
}
