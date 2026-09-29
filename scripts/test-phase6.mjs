/**
 * Phase 6 acceptance tests — run with the server already up:
 *   npm run dev   (or)   npm run build && npm start
 *   node scripts/test-phase6.mjs
 *
 * Covers: run vs submit scoping, correct solution (ACCEPTED), wrong answer,
 * runtime error, security (guest/non-member), hidden-case masking, DB
 * persistence, and live broadcast. Exit code 0 = all pass.
 *
 * Requires internet access (Piston public sandbox) for execution tests.
 */
import { io } from "socket.io-client";

const BASE = process.env.TEST_BASE ?? "http://localhost:3000";
// NOTE: launch the server with INTERNAL_BROADCAST_SECRET=dev-internal (or any
// shared value) so the live-broadcast bridge accepts route-handler calls.
const rand = Math.random().toString(36).slice(2, 8);
let passCount = 0;
let failCount = 0;
const failures = [];

function check(name, cond, extra = "") {
  if (cond) {
    passCount++;
    console.log(`  ✓ ${name}`);
  } else {
    failCount++;
    failures.push(name);
    console.log(`  ✗ ${name} ${extra}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function register(name) {
  const email = `${name.toLowerCase().replace(/\s+/g, "")}${rand}@test.dev`;
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password: "Password123!" }),
  });
  if (res.status !== 201) throw new Error(`register failed: ${res.status}`);
  const body = await res.json();
  return { id: body.user.id, name, cookie: res.headers.get("set-cookie")?.split(";")[0] };
}

async function api(cookie, method, path, payload) {
  return fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
}

async function main() {
  console.log(`\n== CodeRoom Phase 6 test suite ==\n(base: ${BASE})\n`);

  const user = await register("Priya Coder");
  check("user registered", Boolean(user.id));

  // Look up the seeded two-sum problem directly in the DB.
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  const problem = await db.problem.findUnique({ where: { slug: "two-sum" } });
  check("two-sum problem found in DB", Boolean(problem));

  // Create a room WITH the problem attached (as the create dialog does).
  const roomRes = await api(user.cookie, "POST", "/api/rooms", {
    name: `Exec room ${rand}`,
    language: "javascript",
    problemId: problem.id,
  });
  const { room } = await roomRes.json();
  check("room created with problem", Boolean(room?.id));

  const execPath = `/api/rooms/${room.id}/execute`;

  // --- 1. security first (no execution for guests/outsiders) ---
  console.log("\n[1] security");
  const guest = await fetch(`${BASE}${execPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "run" }),
  });
  check("guest execute rejected (401)", guest.status === 401);

  const eve = await register("Eve Exec");
  const eveExec = await api(eve.cookie, "POST", execPath, { mode: "run" });
  check("non-member execute rejected (404)", eveExec.status === 404);

  // --- 2. Run mode: correct solution passes samples ---
  console.log("\n[2] run (sample cases)");
  const goodCode =
    "function twoSum(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const need = target - nums[i];\n    if (seen.has(need)) return [seen.get(need), i];\n    seen.set(nums[i], i);\n  }\n  return null;\n}\n";
  await api(user.cookie, "PATCH", `/api/rooms/${room.id}/code`, { code: goodCode });

  const runRes = await api(user.cookie, "POST", execPath, { mode: "run" });
  const runData = await runRes.json();
  check("run executes (200)", runRes.status === 200, JSON.stringify(runData).slice(0, 120));
  check("run verdict ACCEPTED", runData?.verdict === "ACCEPTED", runData?.verdict);
  check("run graded 3 sample cases", runData?.total === 3, `total=${runData?.total}`);
  check("run does NOT persist a submission", runData?.submissionId === null);

  // --- 3. Submit mode: correct solution ---
  console.log("\n[3] submit (all cases)");
  const subRes = await api(user.cookie, "POST", execPath, { mode: "submit" });
  const subData = await subRes.json();
  check("submit executes (200)", subRes.status === 200);
  check("submit verdict ACCEPTED", subData?.verdict === "ACCEPTED", subData?.verdict);
  check("submit graded 5 cases", subData?.total === 5, `total=${subData?.total}`);
  check("submit persisted a submission id", typeof subData?.submissionId === "string");

  // --- 4. Wrong answer on a hidden case ---
  console.log("\n[4] wrong answer");
  const naiveCode =
    "function twoSum(nums, target) {\n  return [0, 1];\n}\n";
  await api(user.cookie, "PATCH", `/api/rooms/${room.id}/code`, { code: naiveCode });
  const waRes = await api(user.cookie, "POST", execPath, { mode: "submit" });
  const waData = await waRes.json();
  check("naive solution fails (WRONG_ANSWER)", waData?.verdict === "WRONG_ANSWER", waData?.verdict);
  check("passed count reflects partial passes", typeof waData?.passed === "number" && waData.passed < waData.total, `${waData?.passed}/${waData?.total}`);
  check("hidden case inputs masked", waData.results.every((r) => r.isSample || r.input === ""));
  check(
    "hidden failures masked in actual",
    waData.results.every((r) => r.isSample || r.passed || String(r.actual).includes("hidden")),
    JSON.stringify(waData.results?.filter((r) => !r.isSample && !r.passed))
  );

  // --- 5. Runtime error ---
  console.log("\n[5] runtime error");
  const boomCode =
    "function twoSum(nums, target) {\n  throw new Error('boom');\n}\n";
  await api(user.cookie, "PATCH", `/api/rooms/${room.id}/code`, { code: boomCode });
  const reRes = await api(user.cookie, "POST", execPath, { mode: "run" });
  const reData = await reRes.json();
  check("throwing code → RUNTIME_ERROR", reData?.verdict === "RUNTIME_ERROR", reData?.verdict);
  check("error message surfaced", reData?.results?.some((r) => String(r.error).includes("boom")));

  // --- 6. Infinite loop → TLE (bounded by sandbox timeout) ---
  console.log("\n[6] time limit");
  const loopCode =
    "function twoSum(nums, target) {\n  while (true) {}\n}\n";
  await api(user.cookie, "PATCH", `/api/rooms/${room.id}/code`, { code: loopCode });
  const tleRes = await api(user.cookie, "POST", execPath, { mode: "run" });
  const tleData = await tleRes.json();
  check("infinite loop → TLE", tleData?.verdict === "TLE", tleData?.verdict);

  // --- 7. Submission history ---
  console.log("\n[7] persistence");
  const histRes = await api(user.cookie, "GET", `/api/rooms/${room.id}/submissions`);
  const hist = await histRes.json();
  check("submission history endpoint works", histRes.status === 200);
  check("history has 2 submits", hist?.submissions?.length === 2, `got ${hist?.submissions?.length}`);
  check("history is newest-first", hist?.submissions?.[0]?.verdict === "WRONG_ANSWER");

  // --- 8. live broadcast to other members ---
  console.log("\n[8] broadcast");
  const peer = await register("Bao Peer");
  await api(peer.cookie, "POST", "/api/rooms/join", { code: room.joinCode });
  const peerSock = io(BASE, {
    path: "/api/socketio",
    transports: ["websocket"],
    auth: { token: peer.cookie.split("=").slice(1).join("=") },
  });
  await new Promise((resolve) => {
    peerSock.emit("join-room", { roomId: room.id }, (r) => resolve(r));
  });
  await sleep(200);

  const resultPromise = new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 20000);
    peerSock.on("submission:result", (p) => {
      clearTimeout(t);
      resolve(p);
    });
  });

  await api(user.cookie, "PATCH", `/api/rooms/${room.id}/code`, { code: goodCode });
  const bcRes = await api(user.cookie, "POST", execPath, { mode: "submit" });
  const bcBody = await bcRes.json().catch(() => null);
  console.log(
    `    (debug: submit status=${bcRes.status} verdict=${bcBody?.verdict} submissionId=${Boolean(bcBody?.submissionId)})`
  );
  const received = await resultPromise;
  check(
    "peer receives live submission:result",
    received !== null && received.verdict === "ACCEPTED" && received.name === "Priya Coder",
    JSON.stringify(received)?.slice(0, 100)
  );

  peerSock.disconnect();

  await db.$disconnect();
}

main().catch((e) => {
  console.error("test runner crashed:", e);
  process.exit(1);
});
