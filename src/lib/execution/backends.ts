/**
 * Execution backends (Phase 6). Uniform contract:
 *   run({ language, code, stdin }, timeoutMs) → { stdout, stderr, timeout, exitCode }
 *
 * Backends are selected by the EXECUTION_BACKEND env var:
 *   piston (default) | judge0 | docker
 *
 * Sandbox rule (non-negotiable): user code NEVER runs inside the Next.js
 * process. Every backend executes code in an external sandbox.
 */

const PISTON_URL = "https://emkc.org/api/v2/piston";
const JUDGE0_CE_URL = "https://ce.judge0.com";

export type RunResult = {
  stdout: string;
  stderr: string;
  timeout: boolean;
  exitCode: number | null;
};

export type RunInput = {
  stdin: string;
  code: string;
  language: string;
};

export type Backend = {
  name: string;
  run: (input: RunInput, timeoutMs: number) => Promise<RunResult>;
};

const PISTON_VERSIONS: Record<string, string> = {
  javascript: "18.15.0",
  python: "3.10.0",
  java: "15.0.2",
  cpp: "10.2.0",
};

export const pistonBackend: Backend = {
  name: "piston",
  async run({ language, code, stdin }, timeoutMs) {
    const version = PISTON_VERSIONS[language];
    if (!version) {
      return {
        stdout: "",
        stderr: `Unsupported language: ${language}`,
        timeout: false,
        exitCode: null,
      };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs + 8000);
    try {
      const resp = await fetch(`${PISTON_URL}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          language,
          version,
          files: [{ content: code }],
          stdin,
          compile_timeout: 10_000,
          run_timeout: timeoutMs,
        }),
      });
      if (!resp.ok) {
        return {
          stdout: "",
          stderr: `Sandbox error (HTTP ${resp.status})`,
          timeout: false,
          exitCode: null,
        };
      }
      const data = await resp.json();
      const run = data.run ?? {};
      const compile = data.compile;
      if (compile && compile.code !== 0) {
        return {
          stdout: "",
          stderr: compile.stderr ?? "Compilation failed.",
          timeout: false,
          exitCode: compile.code,
        };
      }
      return {
        stdout: String(run.stdout ?? ""),
        stderr: String(run.stderr ?? ""),
        timeout: run.signal === "SIGKILL",
        exitCode: typeof run.code === "number" ? run.code : null,
      };
    } catch (error) {
      return {
        stdout: "",
        stderr: `Sandbox unreachable: ${String(error)}`,
        timeout: false,
        exitCode: null,
      };
    } finally {
      clearTimeout(timer);
    }
  },
};

/* ---------------- Judge0 (optional, via env) ---------------- */

const JUDGE0_URL = process.env.JUDGE0_URL ?? JUDGE0_CE_URL; // public CE by default; self-hosted via env
const JUDGE0_KEY = process.env.JUDGE0_KEY;

const JUDGE0_IDS: Record<string, number> = {
  // Standard Judge0 CE language ids
  javascript: 93,
  python: 71,
  java: 62,
  cpp: 54,
};

export const judge0Backend: Backend = {
  name: "judge0",
  async run({ language, code, stdin }, timeoutMs) {
    const id = JUDGE0_IDS[language];
    if (!id || !JUDGE0_URL) {
      return {
        stdout: "",
        stderr: "Judge0 is not configured (set JUDGE0_URL).",
        timeout: false,
        exitCode: null,
      };
    }
    try {
      const resp = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(JUDGE0_KEY ? { "X-Auth-Token": JUDGE0_KEY, "X-RapidAPI-Key": JUDGE0_KEY } : {}),
        },
        body: JSON.stringify({
          language_id: id,
          source_code: code,
          stdin,
          cpu_time_limit: Math.max(1, Math.ceil(timeoutMs / 1000)),
        }),
      });
      if (!resp.ok) {
        return { stdout: "", stderr: `Judge0 error (HTTP ${resp.status})`, timeout: false, exitCode: null };
      }
      const data = await resp.json();
      // Judge0 status ids: 5 TLE, 6 compile error, 7-12 runtime errors
      return {
        stdout: String(data.stdout ?? ""),
        stderr: String(data.stderr ?? data.compile_output ?? ""),
        timeout: data.status?.id === 5,
        exitCode: typeof data.exit_code === "number" ? data.exit_code : null,
      };
    } catch (error) {
      return { stdout: "", stderr: `Judge0 unreachable: ${String(error)}`, timeout: false, exitCode: null };
    }
  },
};

/* ---------------- Backend selection ---------------- */

export function getBackend(): Backend {
  // Judge0 public CE is the default sandbox (verified working, no key).
  // Piston's public API went whitelist-only (Feb 2026) — kept as an option.
  const choice = (process.env.EXECUTION_BACKEND ?? "judge0").toLowerCase();
  if (choice === "piston") return pistonBackend;
  if (choice === "docker") {
    console.warn("[execution] docker backend not yet wired; falling back to judge0");
  }
  return judge0Backend;
}
