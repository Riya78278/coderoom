// Single source of truth for room languages and starter code.
// Used by the create-room API, the room workspace, and dialogs.

export const LANGUAGE_VALUES = ["javascript", "python", "java", "cpp"] as const;

export type RoomLanguage = (typeof LANGUAGE_VALUES)[number];

export const ROOM_LANGUAGES: { value: RoomLanguage; label: string }[] = [
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
];

export function isRoomLanguage(value: string): value is RoomLanguage {
  return (LANGUAGE_VALUES as readonly string[]).includes(value);
}

export function languageLabel(value: string): string {
  return ROOM_LANGUAGES.find((l) => l.value === value)?.label ?? value;
}

/** Monaco language identifiers (cpp → cplusplus in Monaco). */
export const MONACO_LANGUAGE: Record<RoomLanguage, string> = {
  javascript: "javascript",
  python: "python",
  java: "java",
  cpp: "cpp",
};

const DEFAULT_STARTER: Record<RoomLanguage, string> = {
  javascript: `// Ready — start coding!\n`,
  python: `# Ready — start coding!\n`,
  java: `public class Main {\n    public static void main(String[] args) {\n        // Ready — start coding!\n    }\n}\n`,
  cpp: `#include <iostream>\n\nint main() {\n    // Ready — start coding!\n    return 0;\n}\n`,
};

const PROBLEM_STARTERS: Record<string, Partial<Record<RoomLanguage, string>>> = {
  "two-sum": {
    javascript: `function twoSum(nums, target) {\n  // return [i, j] such that nums[i] + nums[j] === target\n}\n`,
    python: `def two_sum(nums, target):\n    # return [i, j] such that nums[i] + nums[j] == target\n    pass\n`,
    java: `class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // return indices\n    }\n}\n`,
    cpp: `#include <vector>\nusing namespace std;\n\nvector<int> twoSum(vector<int>& nums, int target) {\n    // return indices\n}\n`,
  },
  "reverse-string": {
    javascript: `function reverseString(s) {\n  // return the reversed string\n}\n`,
    python: `def reverse_string(s):\n    # return the reversed string\n    pass\n`,
    java: `class Solution {\n    public String reverseString(String s) {\n        // return the reversed string\n        return s;\n    }\n}\n`,
    cpp: `#include <string>\nusing namespace std;\n\nstring reverseString(string s) {\n    // return the reversed string\n    return s;\n}\n`,
  },
  "valid-palindrome": {
    javascript: `function isPalindrome(s) {\n  // return true if s is a palindrome\n}\n`,
    python: `def is_palindrome(s):\n    # return True if s is a palindrome\n    pass\n`,
    java: `class Solution {\n    public boolean isPalindrome(String s) {\n        // return true if s is a palindrome\n        return false;\n    }\n}\n`,
    cpp: `#include <string>\nusing namespace std;\n\nbool isPalindrome(string s) {\n    // return true if s is a palindrome\n    return false;\n}\n`,
  },
  "maximum-subarray": {
    javascript: `function maxSubArray(nums) {\n  // return the largest subarray sum\n}\n`,
    python: `def max_sub_array(nums):\n    # return the largest subarray sum\n    pass\n`,
    java: `class Solution {\n    public int maxSubArray(int[] nums) {\n        // return the largest subarray sum\n        return 0;\n    }\n}\n`,
    cpp: `#include <vector>\nusing namespace std;\n\nint maxSubArray(vector<int>& nums) {\n    // return the largest subarray sum\n    return 0;\n}\n`,
  },
  "longest-substring-without-repeating-characters": {
    javascript: `function lengthOfLongestSubstring(s) {\n  // return the length\n}\n`,
    python: `def length_of_longest_substring(s):\n    # return the length\n    pass\n`,
    java: `class Solution {\n    public int lengthOfLongestSubstring(String s) {\n        // return the length\n        return 0;\n    }\n}\n`,
    cpp: `#include <string>\nusing namespace std;\n\nint lengthOfLongestSubstring(string s) {\n    // return the length\n    return 0;\n}\n`,
  },
};

/**
 * Starter code for a room's first open: the problem's starter for the chosen
 * language if we have one, else a generic scaffold for that language.
 */
export function starterCodeFor(
  problemSlug: string | null | undefined,
  language: string
): string {
  const lang: RoomLanguage = isRoomLanguage(language) ? language : "javascript";
  const fromProblem = problemSlug
    ? PROBLEM_STARTERS[problemSlug]?.[lang]
    : undefined;
  return fromProblem ?? DEFAULT_STARTER[lang];
}
