"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";

type NavItem = {
  label: string;
  href: string;
  soon?: boolean;
  icon: ReactNode;
};

const ICON_STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" {...ICON_STROKE}>
      <path d={d} />
    </svg>
  );
}

const NAV: NavItem[] = [
  {
    label: "Home",
    href: "/dashboard",
    icon: (
      <Icon d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
    ),
  },
  {
    label: "My Rooms",
    href: "/dashboard",
    icon: <Icon d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 10.5 20.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />,
  },
  {
    label: "Create Room",
    href: "/dashboard?action=create",
    icon: <Icon d="M12 4.5v15m7.5-7.5h-15" />,
  },
  {
    label: "Problems",
    href: "/dashboard/problems",
    soon: true,
    icon: <Icon d="M9.813 15.904 9.5 16.5l-.313-1.656A6 6 0 0 0 5.25 9.5h-.5a.75.75 0 0 1 0-1.5h.5a6 6 0 0 0 5.656-4.094L11.25 2.25l.313 1.656A6 6 0 0 0 16.5 8h.5a.75.75 0 0 1 0 1.5h-.5a6 6 0 0 0-5.656 4.094Z" />,
  },
  {
    label: "Interviews",
    href: "/dashboard/interviews",
    icon: <Icon d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />,
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    soon: true,
    icon: <Icon d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />,
  },
];

export function DashboardShell({
  user,
  children,
}: {
  user: { id: string; name: string; email: string };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* ---------- Sidebar ---------- */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-navy-900 p-4 text-white lg:flex">
        <div className="px-2 py-3">
          <Logo dark href="/dashboard" />
        </div>

        <nav className="mt-6 flex flex-1 flex-col gap-1">          {NAV.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            const content = (
              <>
                <span className={active ? "text-white" : "text-slate-400 group-hover:text-white"}>
                  {item.icon}
                </span>
                {item.label}
                {item.soon && (
                  <span className="ml-auto rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                    Phase 3+
                  </span>
                )}
              </>
            );
            const base = `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
              active
                ? "bg-indigo-600 text-white"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`;
            return item.soon ? (
              <span key={item.label} className={`${base} cursor-default`}>
                {content}
              </span>
            ) : (
              <Link key={item.label} href={item.href} className={base}>
                {content}
              </Link>
            );
          })}
        </nav>

        {/* ---------- User card ---------- */}
        <div className="mt-4 rounded-2xl bg-white/5 p-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-slate-400">{user.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-3 w-full rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* ---------- Content ---------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* mobile topbar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <Logo href="/dashboard" />
          <button onClick={logout} className="btn-secondary px-3 py-1.5 text-xs">
            Log out
          </button>
        </div>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
