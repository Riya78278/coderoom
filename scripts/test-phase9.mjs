/**
 * Phase 9 acceptance tests — code replay recording + timeline API.
 * Run with the server already up:
 *   npm run build && npm start   (or npm run dev)
 *   node scripts/test-phase9.mjs
 *
 * Covers: security (guest/non-member), recording of code ticks (with
 * 2s throttle), language change, chat, problem assignment, submissions,
 * interview lifecycle, oldest-first ordering, and payload contents.
 */
import { io } from "socket.io-client";

const BASE = process.env.TEST_BASE ?? "http://localhost:3000";
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
  console.log(`\n== CodeRoom Phase 9 test suite ==\n(base: ${BASE})\n`);

  const host = await register("Host Recorder");
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  const problem = await db.problem.findUnique({ where: { slug: "two-sum" } });

  const roomRes = await api(host.cookie, "POST", "/api/rooms", {
    name: `Replay room ${rand}`,
    language: "javascript",
    problemId: problem.id,
  });
  const { room } = await roomRes.json();
  check("room created", Boolean(room?.id));
  const roomId = room.id;

  // --- 1. security ---
  console.log("\n[1] security");
  const guest = await fetch(`${BASE}/api/rooms/${roomId}/replay`);
  check("guest replay rejected (401)", guest.status === 401);

  const eve = await register("Eve Snoop");
  const outsider = await api(eve.cookie, "GET", `/api/rooms/${roomId}/replay`);
  check("non-member replay rejected (404)", outsider.status === 404);

  // --- 2. generate activity to record ---
  console.log("\n[2] activity generation");

  // join a peer (chat needs a joined socket)
  const peer = await register("Peer Typist");
  await api(peer.cookie, "POST", "/api/rooms/join", { code: room.joinCode });
  const peerSock = io(BASE, {
    path: "/api/socketio",
    transports: ["websocket"],
    auth: { token: peer.cookie.split("=").slice(1).join("=") },
  });
  await new Promise((resolve) => {
    peerSock.emit("join-room", { roomId }, (r) => resolve(r));
  });
  await sleep(300);

  // code typing via ticks: A and B land inside the 2s throttle window (one
  // event), C lands after it (second event) — the throttle keeps replay
  // storage bounded while preserving document checkpoints.
  peerSock.emit("code-change", { code: "function one() {}\n" });
  peerSock.emit("code-record-tick", { code: "function one() {}\n", language: "javascript" });
  await sleep(300);
  peerSock.emit("code-record-tick", { code: "function two() {}\n", language: "javascript" });
  peerSock.emit("language-change", { language: "python" }, () => {});
  peerSock.emit("chat:message", { content: "replay test message" }, () => {});
  await sleep(2300); // fully exit tick A's throttle window
  peerSock.emit("code-record-tick", { code: "function three() {}\n", language: "python" });
  // switch back to JS so the submission below grades as ACCEPTED
  peerSock.emit("language-change", { language: "javascript" }, () => {});
  await sleep(500);

  // submission via HTTP (host)
  await api(host.cookie, "PATCH", `/api/rooms/${roomId}/code`, {
    code: "function twoSum(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const need = target - nums[i];\n    if (seen.has(need)) return [seen.get(need), i];\n    seen.set(nums[i], i);\n  }\n  return null;\n}\n",
  });
  const execRes = await api(host.cookie, "POST", `/api/rooms/${roomId}/execute`, {
    mode: "submit",
  });
  const execData = await execRes.json().catch(() => null);
  check("submission executed", execRes.status === 200 && execData?.submissionId);

  // interview lifecycle via HTTP (host needs a candidate)
  const intRes = await api(host.cookie, "POST", `/api/rooms/${roomId}/interview`, {
    candidateId: peer.id,
  });
  check("interview started (201)", intRes.status === 201);
  const endRes = await api(host.cookie, "PATCH", `/api/rooms/${roomId}/interview`, {
    rating: 4,
    feedback: "nice",
  });
  check("interview ended (200)", endRes.status === 200);

  peerSock.disconnect();

  // --- 3. verify the timeline ---
  console.log("\n[3] timeline verification");
  const repRes = await api(host.cookie, "GET", `/api/rooms/${roomId}/replay`);
  const rep = await repRes.json();
  check("replay endpoint 200", repRes.status === 200);
  const events = rep?.events ?? [];

  const codeEvents = events.filter((e) => e.type === "code");
  const chatEvents = events.filter((e) => e.type === "chat");
  const langEvents = events.filter((e) => e.type === "language");
  const subEvents = events.filter((e) => e.type === "submission");
  const intEvents = events.filter((e) => e.type === "interview");

  check(
    "code ticks recorded (throttle kept 2 of 3)",
    codeEvents.length === 2,
    `got ${codeEvents.length}`
  );
  check(
    "code events carry full document state",
    codeEvents.length === 2 &&
      codeEvents[0].payload.code === "function one() {}\n" &&
      codeEvents[1].payload.code === "function three() {}\n",
    JSON.stringify(codeEvents.map((e) => e.payload.code))?.slice(0, 80)
  );
  check("chat recorded", chatEvents.length === 1 && chatEvents[0].payload.content === "replay test message");
  check(
    "language changes recorded (python then javascript)",
    langEvents.length === 2 && langEvents[0].payload.language === "python" && langEvents[1].payload.language === "javascript",
    JSON.stringify(langEvents.map((e) => e.payload.language))
  );
  check("submission recorded with verdict", subEvents.length === 1 && subEvents[0].payload.verdict === "ACCEPTED");
  check("interview started+ended recorded", intEvents.length === 2 && intEvents[0].payload.action === "started" && intEvents[1].payload.action === "ended");

  // ordering + names
  const times = events.map((e) => +new Date(e.at));
  check("timeline is oldest-first", times.every((t, i) => i === 0 || t >= times[i - 1]));
  check("user names resolved", events.every((e) => typeof e.userName === "string" && e.userName.length > 0));
  check("event types valid", events.every((e) => ["code", "language", "chat", "submission", "interview", "problem"].includes(e.type)));

  await db.$disconnect();

  console.log(`\n===== RESULTS: ${passCount} passed, ${failCount} failed =====`);
  if (failures.length) {
    console.log("Failed:", failures.join(" | "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("test runner crashed:", e);
  process.exit(1);
});
