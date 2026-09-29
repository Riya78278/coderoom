"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type Mode = "login" | "register";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isRegister = mode === "register";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isRegister ? { name, email, password } : { email, password }
        ),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setPending(false);
        return;
      }

      const next = searchParams.get("next");
      router.replace(next && next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } catch {
      setError("Network error — is the server running?");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {error}
        </div>
      )}

      {isRegister && (
        <div>
          <label htmlFor="name" className="label">
            Full name
          </label>
          <input
            id="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Riya Mondal"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
          />
        </div>
      )}

      <div>
        <label htmlFor="email" className="label">
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="label">
            Password
          </label>
          {!isRegister && (
            <span
              className="text-xs text-slate-400"
              title="Password reset arrives in a later phase"
            >
              Forgot password?
            </span>
          )}
        </div>
        <input
          id="password"
          type="password"
          required
          minLength={isRegister ? 8 : undefined}
          autoComplete={isRegister ? "new-password" : "current-password"}
          placeholder={isRegister ? "At least 8 characters" : "••••••••"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
        />
      </div>

      <button type="submit" disabled={pending} className="btn-primary w-full py-3">
        {pending ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            {isRegister ? "Creating account…" : "Signing in…"}
          </>
        ) : isRegister ? (
          "Create account"
        ) : (
          "Sign in"
        )}
      </button>

      <p className="text-center text-sm text-slate-600">
        {isRegister ? "Already have an account? " : "Don't have an account? "}
        <Link
          href={isRegister ? "/login" : "/register"}
          className="font-semibold text-indigo-600 transition hover:text-indigo-500"
        >
          {isRegister ? "Sign in" : "Sign up free"}
        </Link>
      </p>
    </form>
  );
}
