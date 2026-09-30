/**
 * Phase 8 — offline "smart coach" fallback.
 *
 * When no OPENAI_API_KEY is configured, hints still work: each seeded
 * problem ships a ladder of progressively stronger nudges. The hint route
 * picks a rung based on the candidate's actual code progress, so repeated
 * clicks don't repeat the same tip forever.
 */

type HintLadder = {
  /** code looks empty / starter-only */
  nudge: string;
  /** code has structure but the solution isn't correct yet */
  deeper: string;
  /** code is complete — what to think about next */
  next: string;
};

const LADDERS: Record<string, HintLadder> = {
  "two-sum": {
    nudge:
      "Think about what data structure lets you ask \"have I seen this number before?\" in constant time as you scan the array once.",
    deeper:
      "You're scanning — good. For each number, compute its partner (target − current) and check whether you've already stored that partner's index. A Map gives you O(1) lookups; store number → index as you go.",
    next: "Your function returns an answer — now trace it against the examples: does it return indices in ascending order, and does it handle repeated values like [3,3] with target 6?",
  },
  "reverse-string": {
    nudge:
      "You can build a new string, or swap characters moving inward from both ends. Which one uses O(1) extra memory?",
    deeper:
      "Try two pointers: one at the start, one at the end. Swap, move both toward the middle, stop when they cross.",
    next: "The reversal works — now think about the follow-up: reversing in place means mutating the input directly rather than building a new one.",
  },
  "valid-palindrome": {
    nudge:
      "Two questions: how do you ignore case and non-alphanumeric characters, and how would you compare a string to its reverse?",
    deeper:
      "Normalize first (lowercase, strip non-alphanumerics), then use two pointers from both ends — compare characters, skip nothing, move inward until they meet or mismatch.",
    next: "It passes the examples — check the edge cases: an empty string and a single character should both be palindromes.",
  },
  "maximum-subarray": {
    nudge:
      "Brute force checks every subarray — O(n²). Ask yourself: if I knew the best subarray ending at position i, what would the best one ending at i+1 be?",
    deeper:
      "That's Kadane's algorithm: keep a running sum. At each element, either extend the previous subarray or start fresh — keep whichever is larger. Track the global best as you go.",
    next: "The O(n) solution works — the follow-up asks about divide and conquer: the best subarray is either in the left half, the right half, or crosses the middle.",
  },
  "longest-substring-without-repeating-characters": {
    nudge:
      "A substring is contiguous. Think about maintaining a \"window\" that never contains a duplicate — what do you do when the new character breaks that rule?",
    deeper:
      "Slide a window: move the right edge forward, storing each character's latest index in a Map. When you hit a character you've seen inside the current window, jump the left edge past its previous occurrence.",
    next: "The sliding window works — test \"abba\": after the second 'b', the left edge must jump past the FIRST 'b', not just move one step.",
  },
};

const GENERIC: HintLadder = {
  nudge:
    "Start by restating the problem in your own words and writing the input → output for example 1. Then think about the simplest correct approach before optimizing.",
  deeper:
    "Walk through your code line by line with example 1's input. Where does the actual behavior first differ from what you intended? That gap is the bug.",
  next: "The code runs end to end — now stress it: empty input, single element, duplicates, and the largest allowed size.",
};

export function offlineHintFor(
  problemSlug: string | null,
  code: string,
  language: string
): string {
  const ladder = (problemSlug && LADDERS[problemSlug]) || GENERIC;
  const runnable = language === "javascript" || language === "python";

  if (!runnable) {
    return "Heads up: grading currently supports JavaScript and Python, so switch the language before testing. Meanwhile, outline your approach in comments — pseudocode first, then translate.";
  }

  const trimmed = code.trim();
  const looksStarter =
    trimmed.length < 120 &&
    (/your code here|pass|return null|return 0|return ""|return false|return s;/.test(trimmed) ||
      !/function |def /.test(trimmed));
  const looksComplete = /return\s+[^;\s]/.test(trimmed) && trimmed.length > 150;

  if (looksStarter) return ladder.nudge;
  if (looksComplete) return ladder.next;
  return ladder.deeper;
}
