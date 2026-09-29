import Link from "next/link";

export function Logo({
  href = "/",
  dark = false,
}: {
  href?: string;
  dark?: boolean;
}) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 shadow-md shadow-indigo-600/30 transition-transform group-hover:scale-105">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-5 w-5 text-white"
          aria-hidden="true"
        >
          <path
            d="M9 6.5 4.5 12 9 17.5M15 6.5 19.5 12 15 17.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400" />
      </span>
      <span
        className={`text-lg font-bold tracking-tight ${
          dark ? "text-white" : "text-slate-900"
        }`}
      >
        Code<span className="text-indigo-500">Room</span>
      </span>
    </Link>
  );
}
