/**
 * Seeds sample (Run) and hidden (Submit) test cases for the seeded problems.
 *
 * Input format (Phase 6 protocol): each `input` is a JSON array of the
 * function's arguments, e.g. two-sum → "[[2,7,11,15],9]".
 * Wipes this project's existing cases for these problems first so
 * re-running is idempotent. Run via `npm run db:seed:tests`.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const CASES = {
  "two-sum": [
    { input: "[[2,7,11,15],9]", expectedOutput: "[0,1]", isSample: true },
    { input: "[[3,2,4],6]", expectedOutput: "[1,2]", isSample: true },
    { input: "[[3,3],6]", expectedOutput: "[0,1]", isSample: true },
    { input: "[[-1,-2,-3,-4,-5],-8]", expectedOutput: "[2,4]", isSample: false },
    { input: "[[5,75,25],100]", expectedOutput: "[1,2]", isSample: false },
  ],
  "reverse-string": [
    { input: "[\"hello\"]", expectedOutput: "\"olleh\"", isSample: true },
    { input: "[\"CodeRoom\"]", expectedOutput: "\"mooRedoC\"", isSample: true },
    { input: "[\"a\"]", expectedOutput: "\"a\"", isSample: true },
    { input: "[\"racecar\"]", expectedOutput: "\"racecar\"", isSample: false },
    { input: "[\"AbCdEf\"]", expectedOutput: "\"fEdCbA\"", isSample: false },
  ],
  "valid-palindrome": [
    { input: "[\"A man, a plan, a canal: Panama\"]", expectedOutput: "true", isSample: true },
    { input: "[\"race a car\"]", expectedOutput: "false", isSample: true },
    { input: "[\" \"]", expectedOutput: "true", isSample: true },
    { input: "[\"0P\"]", expectedOutput: "false", isSample: false },
    { input: "[\"Madam, in Eden, I'm Adam\"]", expectedOutput: "true", isSample: false },
  ],
  "maximum-subarray": [
    { input: "[[-2,1,-3,4,-1,2,1,-5,4]]", expectedOutput: "6", isSample: true },
    { input: "[[1]]", expectedOutput: "1", isSample: true },
    { input: "[[5,4,-1,7,8]]", expectedOutput: "23", isSample: true },
    { input: "[[-1]]", expectedOutput: "-1", isSample: false },
    { input: "[[-2,-1]]", expectedOutput: "-1", isSample: false },
  ],
  "longest-substring-without-repeating-characters": [
    { input: "[\"abcabcbb\"]", expectedOutput: "3", isSample: true },
    { input: "[\"bbbbb\"]", expectedOutput: "1", isSample: true },
    { input: "[\"pwwkew\"]", expectedOutput: "3", isSample: true },
    { input: "[\"dvdf\"]", expectedOutput: "3", isSample: false },
    { input: "[\" \"]", expectedOutput: "1", isSample: false },
  ],
};

const SLUGS = Object.keys(CASES);

// Wipe + reseed keeps this idempotent and lets me evolve case data freely.
const problems = await db.problem.findMany({ where: { slug: { in: SLUGS } } });
for (const p of problems) {
  await db.testCase.deleteMany({ where: { problemId: p.id } });
}

let total = 0;
for (const slug of SLUGS) {
  const problem = problems.find((p) => p.slug === slug);
  if (!problem) {
    console.log(`skip ${slug} — problem not found`);
    continue;
  }
  for (const c of CASES[slug]) {
    await db.testCase.create({
      data: {
        problemId: problem.id,
        input: c.input,
        expectedOutput: c.expectedOutput,
        isSample: c.isSample,
      },
    });
    total++;
  }
  console.log(`${slug}: ${CASES[slug].length} test cases`);
}

console.log(`Done — ${total} test cases seeded.`);
await db.$disconnect();
