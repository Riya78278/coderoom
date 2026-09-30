/**
 * Universal test harness (Phase 6, extended: full C++/Java support).
 *
 * Protocol: each test case's `input` is a JSON array of the function's
 * arguments, e.g. two-sum → [[2,7,11,15], 9].
 *
 * JavaScript / Python: args JSON → stdin; the generated runner parses it,
 * calls the user's function, prints one RESULT line.
 *
 * C++ / Java: the harness converts args (in TypeScript) to a simple line
 * protocol — one line per argument, arrays as space-separated values — and
 * injects a per-problem glue `main` that parses the lines and calls the
 * user's function. Glue is keyed by (slug, language) so the argument types
 * always match the seeded problem signatures.
 *
 * One sandbox execution per test case — isolated and leak-proof.
 */

export const RESULT_MARKER = "<<RESULT>>";
export const ERROR_PREFIX = "__ERROR__";

const FUNCTION_NAMES: Record<string, Record<string, string>> = {
  "two-sum": { javascript: "twoSum", python: "two_sum", cpp: "twoSum", java: "twoSum" },
  "reverse-string": { javascript: "reverseString", python: "reverse_string", cpp: "reverseString", java: "reverseString" },
  "valid-palindrome": { javascript: "isPalindrome", python: "is_palindrome", cpp: "isPalindrome", java: "isPalindrome" },
  "maximum-subarray": { javascript: "maxSubArray", python: "max_sub_array", cpp: "maxSubArray", java: "maxSubArray" },
  "longest-substring-without-repeating-characters": {
    javascript: "lengthOfLongestSubstring",
    python: "length_of_longest_substring",
    cpp: "lengthOfLongestSubstring",
    java: "lengthOfLongestSubstring",
  },
};

export function functionNameFor(slug: string, language: string): string | null {
  return FUNCTION_NAMES[slug]?.[language] ?? null;
}

/** JS/Python args stay JSON; C++/Java use the line protocol. */
export function stdinFor(language: string, inputJson: string): string {
  if (language === "javascript" || language === "python") return inputJson;
  if (language === "cpp" || language === "java") {
    let args: unknown[];
    try {
      const parsed = JSON.parse(inputJson);
      args = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return "\n";
    }
    const lines = args.map((a) => (Array.isArray(a) ? a.join(" ") : String(a)));
    return `${lines.join("\n")}\n`;
  }
  return inputJson;
}

/* ---------------------------------------------------------------------- */
/* C++ glue: per-problem main() matching the seeded signatures            */
/* ---------------------------------------------------------------------- */

const CPP_RUNNERS: Record<string, (fn: string) => string> = {
  "two-sum": (fn) => `
void __runcase() {
  std::string __line;
  std::getline(std::cin, __line);
  std::vector<int> __nums; std::istringstream __s1(__line); int __v;
  while (__s1 >> __v) __nums.push_back(__v);
  std::getline(std::cin, __line);
  long long __target = std::stoll(__line);
  std::vector<int> __r = ${fn}(__nums, (int)__target);
  std::cout << "${RESULT_MARKER}[" << __r[0] << "," << __r[1] << "]" << std::endl;
}
`,
  "reverse-string": (fn) => `
void __runcase() {
  std::string __line;
  std::getline(std::cin, __line);
  std::cout << "${RESULT_MARKER}" << char(34) << ${fn}(__line) << char(34) << std::endl;
}
`,
  "valid-palindrome": (fn) => `
void __runcase() {
  std::string __line;
  std::getline(std::cin, __line);
  std::cout << "${RESULT_MARKER}" << (${fn}(__line) ? "true" : "false") << std::endl;
}
`,
  "maximum-subarray": (fn) => `
void __runcase() {
  std::string __line;
  std::cin.ignore();
  std::getline(std::cin, __line);
  std::vector<int> __nums; std::istringstream __s1(__line); int __v;
  while (__s1 >> __v) __nums.push_back(__v);
  std::cout << "${RESULT_MARKER}" << ${fn}(__nums) << std::endl;
}
`,
  "longest-substring-without-repeating-characters": (fn) => `
void __runcase() {
  std::string __line;
  std::getline(std::cin, __line);
  std::cout << "${RESULT_MARKER}" << ${fn}(__line) << std::endl;
}
`,
};

const CPP_PRELUDE = `
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <algorithm>
#include <unordered_map>
#include <unordered_set>
#include <climits>
using namespace std;
`;

function cppProgram(slug: string, fn: string, userCode: string): string {
  const runner = CPP_RUNNERS[slug];
  if (!runner) return null as unknown as string;
  // __runcase must be declared BEFORE main (C++ requires it).
  return `${CPP_PRELUDE}
${userCode}

// ---- CodeRoom runner (auto-generated) ----
${runner(fn)}
int main() {
  try {
    __runcase();
  } catch (const std::exception& __e) {
    std::cout << "${RESULT_MARKER}${ERROR_PREFIX}" << __e.what() << std::endl;
  } catch (...) {
    std::cout << "${RESULT_MARKER}${ERROR_PREFIX}runtime error" << std::endl;
  }
  return 0;
}
`;
}

/* ---------------------------------------------------------------------- */
/* Java glue: Main.java wraps the user's `class Solution { ... }`         */
/* ---------------------------------------------------------------------- */

const JAVA_CALLS: Record<
  string,
  { parse: string; call: (fn: string) => string; print: (expr: string) => string }
> = {
  "two-sum": {
    parse: `int[] __nums = Arrays.stream(__l1.trim().split("\\\\s+")).mapToInt(Integer::parseInt).toArray();
      int __target = Integer.parseInt(__l2.trim());`,
    call: (fn) => `int[] __r = __sol.${fn}(__nums, __target);`,
    print: () => `System.out.println("${RESULT_MARKER}[" + __r[0] + "," + __r[1] + "]");`,
  },
  "reverse-string": {
    parse: ``,
    call: (fn) => `String __r = __sol.${fn}(__l1);`,
    print: () => `System.out.println("${RESULT_MARKER}" + "\\\"" + __r + "\\\"");`,
  },
  "valid-palindrome": {
    parse: ``,
    call: (fn) => `boolean __r = __sol.${fn}(__l1);`,
    print: () => `System.out.println("${RESULT_MARKER}" + __r);`,
  },
  "maximum-subarray": {
    parse: `int[] __nums = __l1.trim().isEmpty() ? new int[0] : Arrays.stream(__l1.trim().split("\\\\s+")).mapToInt(Integer::parseInt).toArray();`,
    call: (fn) => `int __r = __sol.${fn}(__nums);`,
    print: () => `System.out.println("${RESULT_MARKER}" + __r);`,
  },
  "longest-substring-without-repeating-characters": {
    parse: ``,
    call: (fn) => `int __r = __sol.${fn}(__l1);`,
    print: () => `System.out.println("${RESULT_MARKER}" + __r);`,
  },
};

function javaProgram(slug: string, fn: string, userCode: string): string | null {
  const spec = JAVA_CALLS[slug];
  if (!spec) return null;
  // User code is expected to define `class Solution { ... }` (as the seeded
  // starter code does). We strip any existing import lines (we add our own).
  const body = userCode.replace(/^\s*import\s+.*;$/gm, "");
  return `import java.util.*;
import java.util.stream.*;

${body}

// ---- CodeRoom runner (auto-generated) ----
public class Main {
  public static void main(String[] args) {
    try (Scanner __sc = new Scanner(System.in)) {
      String __l1 = __sc.hasNextLine() ? __sc.nextLine() : "";
      String __l2 = __sc.hasNextLine() ? __sc.nextLine() : "";
      Solution __sol = new Solution();
      ${spec.parse}
      ${spec.call(fn)}
      ${spec.print("__r")}
    } catch (Exception __e) {
      System.out.println("${RESULT_MARKER}${ERROR_PREFIX}" + __e.getMessage());
    }
  }
}
`;
}

/* ---------------------------------------------------------------------- */
/* Public API                                                             */
/* ---------------------------------------------------------------------- */

/** Builds the full program for ONE test case. null = unsupported. */
export function buildProgram(
  language: string,
  fnName: string,
  userCode: string,
  inputJson: string,
  problemSlug?: string
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
  if (language === "cpp") {
    if (!problemSlug) return null;
    return cppProgram(problemSlug, fnName, userCode);
  }
  if (language === "java") {
    if (!problemSlug) return null;
    return javaProgram(problemSlug, fnName, userCode);
  }
  return null;
}
