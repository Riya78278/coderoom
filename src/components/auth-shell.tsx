import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { EditorMock } from "@/components/editor-mock";

/**
 * Split-screen shell shared by /login and /register:
 * dark brand panel with the live-room mock, white form panel.
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* ---------- Brand panel ---------- */}
      <div className="relative hidden overflow-hidden bg-navy-950 p-10 text-white lg:flex lg:flex-col">
        <div className="glow-grid absolute inset-0" />
        <div className="code-grid absolute inset-0 opacity-60" />
        <div className="relative flex h-full flex-col">
          <Logo dark />
          <div className="my-auto max-w-lg py-10">
            <h2 className="text-3xl font-bold tracking-tight text-balance">
              Step into the room where code happens.
            </h2>
            <p className="mt-3 text-slate-300">
              Live cursors, instant sync, real conversations — the closest
              thing to sitting next to your pair, from anywhere.
            </p>
            <div className="mt-8">
              <EditorMock />
            </div>
          </div>
          <div className="relative flex items-center gap-6 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Real-time sync
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              Shared cursors
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              Session history
            </span>
          </div>
        </div>
      </div>

      {/* ---------- Form panel ---------- */}
      <div className="flex items-center justify-center bg-white px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {title}
          </h1>
          <p className="mt-1.5 mb-8 text-sm text-slate-600">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
