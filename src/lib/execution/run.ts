/**
 * Execution orchestrator (Phase 6).
 *
 * Grades a submission: for each test case, builds the harness program,
 * executes it in the sandbox, parses the RESULT marker, compares with
 * expected output. Hidden-case details are masked in the results.
 */
import { getBackend } from "./backends";
import {
  buildProgram,
  functionNameFor,
  RESULT_MARKER,
  ERROR_PREFIX,
} from "./harness";

export type CaseResult = {
  index: number;
  isSample: boolean;
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
  error: string | null;
  skipped?: boolean;
};

export type GradeResult = {
  verdict: string;
  passed: number;
  total: number;
  runtimeMs: number;
  results: CaseResult[];
  stderr: string;
};

const CASE_TIMEOUT_MS = 5000;
const MAX_CASES = 12;

function compare(actual: string, expected: string): boolean {
  return actual.trim() === expected.trim();
}

export async function gradeSubmission({
  language,
  code,
  problemSlug,
  cases,
}: {
  language: string;
  code: string;
  problemSlug: string | null;
  cases: { input: string; expectedOutput: string; isSample: boolean }[];
}): Promise<GradeResult> {
  const started = Date.now();
  const backend = getBackend();
  const fnName = problemSlug ? functionNameFor(problemSlug, language) : null;
  const results: CaseResult[] = [];

  if (!fnName) {
    return {
      verdict: "UNSUPPORTED",
      passed: 0,
      total: cases.length,
      runtimeMs: 0,
      results: [],
      stderr: "Language not supported for grading yet (JS + Python only).",
    };
  }

  const limited = cases.slice(0, MAX_CASES);
  let stop = false;
  let lastStderr = "";

  for (const [index, testCase] of limited.entries()) {
    if (stop) {
      results.push({
        index,
        isSample: testCase.isSample,
        passed: false,
        input: "",
        expected: "",
        actual: testCase.isSample ? "skipped" : "✗ hidden (skipped)",
        error: null,
        skipped: true,
      });
      continue;
    }

    const program = buildProgram(language, fnName, code, testCase.input);
    if (!program) {
      stop = true;
      results.push({
        index,
        isSample: testCase.isSample,
        passed: false,
        input: "",
        expected: "",
        actual: "",
        error: "UNSUPPORTED",
      });
      continue;
    }

    const run = await backend.run(
      { language, code: program, stdin: testCase.input },
      CASE_TIMEOUT_MS
    );
    if (run.stderr) lastStderr = run.stderr;

    const markerIdx = run.stdout.indexOf(RESULT_MARKER);
    let actual = "";
    let caseError: string | null = null;

    if (run.timeout) {
      caseError = "TIME_LIMIT_EXCEEDED";
    } else if (markerIdx === -1) {
      caseError = "RUNTIME_ERROR";
    } else {
      const line = run.stdout
        .slice(markerIdx)
        .split("\n")[0]
        .slice(RESULT_MARKER.length)
        .trim();
      if (line.startsWith(ERROR_PREFIX)) {
        caseError = `RUNTIME_ERROR: ${line.slice(ERROR_PREFIX.length)}`;
      } else {
        actual = line;
      }
    }

    const passed =
      caseError === null && compare(actual, testCase.expectedOutput);
    if (!passed) stop = true;

    results.push({
      index,
      isSample: testCase.isSample,
      passed,
      input: testCase.isSample ? testCase.input : "",
      expected: testCase.isSample ? testCase.expectedOutput : "",
      actual: testCase.isSample
        ? actual
        : passed
          ? "✓"
          : "✗ hidden case",
      error: caseError,
    });
  }

  const passedCount = results.filter((r) => r.passed).length;
  const total = limited.length;
  const allPassed = passedCount === total && total > 0;
  const firstError = results.find((r) => r.error);

  const verdict = allPassed
    ? "ACCEPTED"
    : firstError?.error === "TIME_LIMIT_EXCEEDED"
      ? "TLE"
      : firstError?.error?.startsWith("RUNTIME_ERROR")
        ? "RUNTIME_ERROR"
        : "WRONG_ANSWER";

  return {
    verdict,
    passed: passedCount,
    total,
    runtimeMs: Date.now() - started,
    results,
    stderr: lastStderr,
  };
}
