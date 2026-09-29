// Seed starter problems for CodeRoom (Phase 2).
// Run via `npx prisma db seed` (see "prisma" config in package.json) or `node prisma/seed.mjs`.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const starter = {
  javascript: (fn) => `function ${fn}() {\n  // your code here\n}\n`,
  python: (fn) => `def ${fn}():\n    # your code here\n    pass\n`,
  java: (fn) =>
    `class Solution {\n    public void ${fn}() {\n        // your code here\n    }\n}\n`,
  cpp: (fn) => `#include <vector>\n\nvoid ${fn}() {\n    // your code here\n}\n`,
};

const problems = [
  {
    slug: "two-sum",
    title: "Two Sum",
    difficulty: "EASY",
    description:
      "Given an array of integers nums and an integer target, return the indices of the two numbers that add up to target.\n\nYou may assume that each input has exactly one solution, and you may not use the same element twice. Return the answer in ascending order.",
    examples: [
      { input: "nums = [2,7,11,15], target = 9", output: "[0,1]", explanation: "nums[0] + nums[1] = 9" },
      { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
      { input: "nums = [3,3], target = 6", output: "[0,1]" },
    ],
    constraints: [
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
      "-10^9 <= target <= 10^9",
      "Exactly one valid answer exists.",
    ],
    starterCode: {
      javascript: `function twoSum(nums, target) {\n  // return [i, j] such that nums[i] + nums[j] === target\n}\n`,
      python: `def two_sum(nums, target):\n    # return [i, j] such that nums[i] + nums[j] == target\n    pass\n`,
      java: `class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // return indices\n    }\n}\n`,
      cpp: `#include <vector>\nusing namespace std;\n\nvector<int> twoSum(vector<int>& nums, int target) {\n    // return indices\n}\n`,
    },
  },
  {
    slug: "reverse-string",
    title: "Reverse String",
    difficulty: "EASY",
    description:
      "Write a function that reverses a string and returns it.\n\nFollow-up: can you do it in-place using O(1) extra memory (modifying the input array of characters)?",
    examples: [
      { input: 's = "hello"', output: '"olleh"' },
      { input: 's = "CodeRoom"', output: '"mooRedoC"' },
    ],
    constraints: ["1 <= s.length <= 10^5", "s consists of printable ASCII characters."],
    starterCode: {
      javascript: `function reverseString(s) {\n  // return the reversed string\n}\n`,
      python: `def reverse_string(s):\n    # return the reversed string\n    pass\n`,
      java: `class Solution {\n    public String reverseString(String s) {\n        // return the reversed string\n        return s;\n    }\n}\n`,
      cpp: `#include <string>\nusing namespace std;\n\nstring reverseString(string s) {\n    // return the reversed string\n    return s;\n}\n`,
    },
  },
  {
    slug: "valid-palindrome",
    title: "Valid Palindrome",
    difficulty: "EASY",
    description:
      "A phrase is a palindrome if, after converting all uppercase letters to lowercase and removing all non-alphanumeric characters, it reads the same forward and backward.\n\nGiven a string s, return true if it is a palindrome, or false otherwise.",
    examples: [
      { input: 's = "A man, a plan, a canal: Panama"', output: "true", explanation: '"amanaplanacanalpanama" is a palindrome.' },
      { input: 's = "race a car"', output: "false" },
      { input: 's = " "', output: "true", explanation: "After removing non-alphanumeric characters, s is an empty string." },
    ],
    constraints: ["1 <= s.length <= 2 * 10^5", "s consists only of printable ASCII characters."],
    starterCode: {
      javascript: `function isPalindrome(s) {\n  // return true if s is a palindrome\n}\n`,
      python: `def is_palindrome(s):\n    # return True if s is a palindrome\n    pass\n`,
      java: `class Solution {\n    public boolean isPalindrome(String s) {\n        // return true if s is a palindrome\n        return false;\n    }\n}\n`,
      cpp: `#include <string>\nusing namespace std;\n\nbool isPalindrome(string s) {\n    // return true if s is a palindrome\n    return false;\n}\n`,
    },
  },
  {
    slug: "maximum-subarray",
    title: "Maximum Subarray",
    difficulty: "MEDIUM",
    description:
      "Given an array of integers nums, find the contiguous subarray with the largest sum and return that sum.\n\nFollow-up: if you have figured out the O(n) solution, try coding another solution using the divide-and-conquer approach.",
    examples: [
      { input: "nums = [-2,1,-3,4,-1,2,1,-5,4]", output: "6", explanation: "[4,-1,2,1] has the largest sum 6." },
      { input: "nums = [1]", output: "1" },
      { input: "nums = [5,4,-1,7,8]", output: "23" },
    ],
    constraints: ["1 <= nums.length <= 10^5", "-10^4 <= nums[i] <= 10^4"],
    starterCode: {
      javascript: `function maxSubArray(nums) {\n  // return the largest subarray sum\n}\n`,
      python: `def max_sub_array(nums):\n    # return the largest subarray sum\n    pass\n`,
      java: `class Solution {\n    public int maxSubArray(int[] nums) {\n        // return the largest subarray sum\n        return 0;\n    }\n}\n`,
      cpp: `#include <vector>\nusing namespace std;\n\nint maxSubArray(vector<int>& nums) {\n    // return the largest subarray sum\n    return 0;\n}\n`,
    },
  },
  {
    slug: "longest-substring-without-repeating-characters",
    title: "Longest Substring Without Repeating Characters",
    difficulty: "MEDIUM",
    description:
      "Given a string s, find the length of the longest substring without repeating characters.",
    examples: [
      { input: 's = "abcabcbb"', output: "3", explanation: 'The answer is "abc", length 3.' },
      { input: 's = "bbbbb"', output: "1", explanation: 'The answer is "b", length 1.' },
      { input: 's = "pwwkew"', output: "3", explanation: 'The answer is "wke" — note it must be a substring, not a subsequence.' },
    ],
    constraints: ["0 <= s.length <= 5 * 10^4", "s consists of English letters, digits, symbols and spaces."],
    starterCode: {
      javascript: `function lengthOfLongestSubstring(s) {\n  // return the length\n}\n`,
      python: `def length_of_longest_substring(s):\n    # return the length\n    pass\n`,
      java: `class Solution {\n    public int lengthOfLongestSubstring(String s) {\n        // return the length\n        return 0;\n    }\n}\n`,
      cpp: `#include <string>\nusing namespace std;\n\nint lengthOfLongestSubstring(string s) {\n    // return the length\n    return 0;\n}\n`,
    },
  },
];

for (const p of problems) {
  await db.problem.upsert({
    where: { slug: p.slug },
    update: {
      title: p.title,
      difficulty: p.difficulty,
      description: p.description,
      examples: p.examples,
      constraints: p.constraints,
      starterCode: p.starterCode,
    },
    create: p,
  });
  console.log(`seeded problem: ${p.title}`);
}

console.log(`Done — ${problems.length} problems in database.`);
await db.$disconnect();
