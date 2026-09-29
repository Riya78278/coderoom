/**
 * Universal test harness (Phase 6).
 *
 * Protocol: each test case's `input` is a JSON array of function arguments,
 * e.g. two-sum → [[2,7,11,15], 9]; reverse-string → ["hello"].
 * The user's code gets a small runner appended that:
 *   1. reads stdin (the JSON args array),
 *   2. calls the user's function with the args spread,
 *   3. prints one line: `<<RESULT>><json>` or `<<RESULT>>__ERROR__<message>`.
 *
 * One sandbox execution per test case — simple, isolated, and leak-proof.
 * Java/C++ return null (documented limitation for now: JS + Python graded).
 */

export const RESULT_MARKER = "<<RESULT>>";
export const ERROR_PREFIX = "__ERROR__";

const FUNCTION_NAMES: Record<string, Record<string, string>> = {
  "two-sum": { javascript: "twoSum", python: "two_sum" },
  "reverse-string": { javascript: "reverseString", python: "reverse_string" },
  "valid-palindrome": { javascript: "isPalindrome", python: "is_palindrome" },
  "maximum-subarray": { javascript: "maxSubArray", python: "max_sub_array" },
  "longest-substring-without-repeating-characters": {
    javascript: "lengthOfLongestSubstring",
    python: "length_of_longest_substring",
  },
};

export function functionNameFor(slug: string, language: string): string | null {
  return FUNCTION_NAMES[slug]?.[language] ?? null;
}

/** Builds the full program for ONE test case. null = unsupported language. */
export function buildProgram(
  language: string,
  fnName: string,
  userCode: string,
  inputJson: string
): string | null {
  if (language === "javascript") {
    return `${userCode}

/* ---- CodeRoom runner (auto-generated) ---- */
const __fs = require("fs");
const __args = JSON.parse(__fs.readFileSync(0, "utf8"));
(async () => {
  try {
    const __r = await ${fnName}(...__args);
    console.log("${RESULT_MARKER}" + JSON.stringify(__r === undefined ? null : __r));
  } catch (e) {
    console.log("${RESULT_MARKER}${ERROR_PREFIX}" + (e && e.message ? e.message : String(e)));
  }
})();
`;
  }
  if (language === "python") {
    return `${userCode}

# ---- CodeRoom runner (auto-generated) ----
import sys as __sys, json as __json
__args = __json.loads(__sys.stdin.read())
try:
    __res = ${fnName}(*__args)
    print("${RESULT_MARKER}" + __json.dumps(__res))
except Exception as __e:
    print("${RESULT_MARKER}${ERROR_PREFIX}" + str(__e))
`;
  }
  return null;
}
