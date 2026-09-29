/**
 * Phase 5 acceptance tests — run with the server already up:
 *   npm run dev   (or)   npm run build && npm start
 *   node scripts/test-phase5.mjs
 *
 * Covers: interview permissions, duplicate-start rejection, live socket
 * relay, end-of-session snapshot + room completion, history for both
 * participants, detail snapshots, and security rejections.
 * Exit code 0 = all pass.
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
  return {
    id: body.user.id,
    name,
    email,
    cookie: res.headers.get("set-cookie")?.split(";")[0],
  };
}

async function createRoom(cookie) {
  const res = await fetch(`${BASE}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ name: `Interview room ${rand}`, language: "javascript" }),
  });
  if (res.status !== 201) throw new Error(`create room failed: ${res.status}`);
  return (await res.json()).room;
}

async function api(cookie, method, path, payload) {
  return fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
}

function socketFor(cookie) {
  const token = cookie.split("=").slice(1).join("=");
  return io(BASE, {
    path: "/api/socketio",
    transports: ["websocket"],
    auth: { token },
  });
}

function once(socket, event, predicate, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);
    const handler = (payload) => {
      if (!predicate(payload)) return;
      cleanup();
      resolve(payload);
    };
    const cleanup = () => {
      clearTimeout(timer);
      socket.off(event, handler);
    };
    socket.on(event, handler);
  });
}

async function main() {
  console.log(`\n== CodeRoom Phase 5 test suite ==\n(base: ${BASE})\n`);

  // --- Setup ---
  const host = await register("Hina Host");
  const cand = await register("Caleb Candidate");
  const outsider = await register("Omar Outside");
  check("registered host + candidate + outsider", Boolean(host.id && cand.id && outsider.id));

  const room = await createRoom(host.cookie);
  check("room created", Boolean(room.id));
  const joinRes = await api(cand.cookie, "POST", "/api/rooms/join", { code: room.joinCode });
  check("candidate joined room", joinRes.status === 200);

  // Seed some code so the end-of-session snapshot has content.
  await api(host.cookie, "PATCH", `/api/rooms/${room.id}/code`, {
    code: "function solve() {\n  // candidate progress\n}\n",
  });

  const ivPath = `/api/rooms/${room.id}/interview`;

  // --- 1. permissions ---
  console.log("\n[1] permissions");
  const nonHost = await api(cand.cookie, "POST", ivPath, { candidateId: host.id });
  check("non-host cannot start (403)", nonHost.status === 403);

  const guest = await fetch(`${BASE}${ivPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateId: cand.id }),
  });
  check("guest cannot start (401)", guest.status === 401);

  const selfStart = await api(host.cookie, "POST", ivPath, { candidateId: host.id });
  check("host cannot interview himself (400)", selfStart.status === 400);

  // --- 2. start ---
  console.log("\n[2] start");
  const startRes = await api(host.cookie, "POST", ivPath, { candidateId: cand.id });
  check("host starts interview (201)", startRes.status === 201);
  const started = await startRes.json();
  check("interview record returned with ids", Boolean(started?.interview?.id && started.interview.candidateId === cand.id));

  const dup = await api(host.cookie, "POST", ivPath, { candidateId: cand.id });
  check("duplicate start rejected (409)", dup.status === 409);

  const activeRes = await api(cand.cookie, "GET", ivPath);
  const activeData = await activeRes.json();
  check("GET active interview works for member", activeRes.status === 200 && activeData.interview?.id === started.interview.id);

  // --- 3. live socket relay ---
  console.log("\n[3] socket relay");
  const hostSock = socketFor(host.cookie);
  const candSock = socketFor(cand.cookie);
  const hostJoin = await new Promise((resolve) => {
    hostSock.emit("join-room", { roomId: room.id }, (r) => resolve(r));
  });
  check("host socket joined", hostJoin?.ok === true);

  const endedPromise = once(candSock, "interview:update", (p) => p.action === "ended", 10000);
  const startedPromise = once(
    candSock,
    "interview:update",
    (p) => p.action === "started",
    8000
  );
  await sleep(300);
  const candJoinAck = await new Promise((resolve) => {
    candSock.emit("join-room", { roomId: room.id }, (r) => resolve(r));
  });
  check("candidate socket joined", candJoinAck?.ok === true);

  // The host's browser emits this relay after a successful REST start.
  hostSock.emit("interview:update", { action: "started", interviewId: started.interview.id });
  const startedRelay = await startedPromise;
  check("candidate receives live 'started' relay", startedRelay !== null);

  // Host ends the session with feedback.
  console.log("\n[4] end + snapshot");
  const endRes = await api(host.cookie, "PATCH", ivPath, {
    rating: 4,
    feedback: "Good communication, needs practice on edge cases.",
  });
  check("host ends interview (200)", endRes.status === 200);
  const endedData = await endRes.json();
  check("interview completed with rating + feedback", endedData?.interview?.status === "COMPLETED" && endedData.interview.rating === 4);

  // The host's browser emits this relay after a successful REST end.
  hostSock.emit("interview:update", { action: "ended", interviewId: started.interview.id });
  const endedRelay = await endedPromise;
  check("candidate receives live 'ended' relay", endedRelay !== null);

  const roomAfter = await api(host.cookie, "GET", `/api/rooms/${room.id}`);
  const roomData = await roomAfter.json();
  check("room status now COMPLETED", roomData?.room?.status === "COMPLETED");

  // --- 5. history for both participants ---
  console.log("\n[5] history");
  const hostList = await api(host.cookie, "GET", "/api/interviews");
  const hostData = await hostList.json();
  const hostEntry = hostData.interviews?.find((i) => i.id === started.interview.id);
  check("interview in host's history", Boolean(hostEntry));

  const candList = await api(cand.cookie, "GET", "/api/interviews");
  const candData = await candList.json();
  check("interview in candidate's history", Boolean(candData.interviews?.some((i) => i.id === started.interview.id)));

  // --- 6. detail + snapshots ---
  console.log("\n[6] detail + snapshots");
  const detailRes = await api(cand.cookie, "GET", `/api/interviews/${started.interview.id}`);
  const detail = await detailRes.json();
  check("candidate can open detail (200)", detailRes.status === 200);
  check(
    "snapshot captured the final code",
    Array.isArray(detail?.interview?.snapshots) &&
      detail.interview.snapshots.some((s) => s.code.includes("candidate progress"))
  );
  check("detail includes rating 4 + feedback text", detail?.interview?.rating === 4 && detail.interview.feedback?.includes("edge cases"));

  const outsiderDetail = await api(outsider.cookie, "GET", `/api/interviews/${started.interview.id}`);
  check("outsider cannot open detail (404)", outsiderDetail.status === 404);

  // --- 7. ending twice / after completion ---
  console.log("\n[7] post-completion");
  const endAgain = await api(host.cookie, "PATCH", ivPath, { rating: 5 });
  check("ending again rejected (404)", endAgain.status === 404);
  const startAfter = await api(host.cookie, "POST", ivPath, { candidateId: cand.id });
  check("starting again rejected (404, room completed)", startAfter.status === 404);

  hostSock.disconnect();
  candSock.disconnect();

  console.log(`\n===== RESULTS: ${passCount} passed, ${failCount} failed =====`);
  if (failures.length) console.log("Failed:", failures.join(" | "));
  process.exit(failCount === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("test runner crashed:", e);
  process.exit(1);
});
