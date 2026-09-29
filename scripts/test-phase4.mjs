/**
 * Phase 4 acceptance tests — run with the server already up:
 *   npm run dev   (or)   npm run build && npm start
 *   node scripts/test-phase4.mjs
 *
 * Covers: join/auth, room-state, presence, code sync both directions,
 * cursor relay, language sync, chat persistence, typing indicators,
 * security rejections, and persistence across reconnect.
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

/* ---------- helpers ---------- */

async function register(name) {
  const email = `${name.toLowerCase().replace(/\s+/g, "")}${rand}@test.dev`;
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password: "Password123!" }),
  });
  if (res.status !== 201) throw new Error(`register failed: ${res.status}`);
  const cookie = res.headers.get("set-cookie")?.split(";")[0];
  return { name, email, cookie };
}

async function createRoom(cookie) {
  const res = await fetch(`${BASE}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ name: `Phase4 room ${rand}`, language: "javascript" }),
  });
  if (res.status !== 201) throw new Error(`create room failed: ${res.status}`);
  return (await res.json()).room;
}

async function joinRoomByCode(cookie, code) {
  return fetch(`${BASE}/api/rooms/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ code }),
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

function emitAck(socket, event, payload, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, __timeout: true }), timeoutMs);
    socket.emit(event, payload, (res) => {
      clearTimeout(timer);
      resolve(res ?? { ok: false });
    });
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
  console.log(`\n== CodeRoom Phase 4 test suite ==\n(base: ${BASE})\n`);

  // --- Setup ---
  const alice = await register("Alice RT");
  const bob = await register("Bob RT");
  check("register A + B", Boolean(alice.cookie && bob.cookie));

  const room = await createRoom(alice.cookie);
  check("room created, 6-char code", room?.joinCode?.length === 6, room?.joinCode);

  const bobJoinRes = await joinRoomByCode(bob.cookie, room.joinCode);
  check("B joined via HTTP (200)", bobJoinRes.status === 200);

  const aliceSock = socketFor(alice.cookie);
  const bobSock = socketFor(bob.cookie);

  // --- 1. join + room-state ---
  console.log("\n[1] join + room state");
  const aliceJoin = await emitAck(aliceSock, "join-room", { roomId: room.id });
  check("A joins by roomId", aliceJoin.ok === true, aliceJoin.error);
  check("A gets room-state with code", typeof aliceJoin.state?.room?.code === "string");
  check("A is HOST with color + sid", aliceJoin.you?.role === "HOST" && Boolean(aliceJoin.you?.color) && Boolean(aliceJoin.you?.sid));

  const bobJoin = await emitAck(bobSock, "join-room", { code: room.joinCode });
  check("B joins by 6-char code", bobJoin.ok === true, bobJoin.error);
  check(
    "B sees A in presence snapshot",
    Boolean(bobJoin.state?.presence?.some((p) => p.userId === aliceJoin.you?.userId))
  );

  // --- 2. presence on join ---
  console.log("\n[2] presence");
  const presencePromise = once(
    aliceSock,
    "presence:update",
    (list) => Array.isArray(list) && list.some((p) => p.userId === bobJoin.you?.userId),
    5000
  );
  await sleep(200);
  const presenceAfterB = await presencePromise;
  check("A gets presence:update when B joins", presenceAfterB !== null);

  // --- 3. code sync both directions ---
  console.log("\n[3] code sync");
  const codeToB = once(bobSock, "code-change", (p) => String(p.code ?? "").includes("alice was here"), 5000);
  await sleep(150);
  aliceSock.emit("code-change", { code: "// alice was here\nint main() {}" });
  const pushB = await codeToB;
  check("B receives A's code-change", pushB !== null);

  const codeToA = once(aliceSock, "code-change", (p) => String(p.code ?? "").includes("bob reply"), 5000);
  await sleep(150);
  bobSock.emit("code-change", { code: "// bob reply" });
  const pushA = await codeToA;
  check("A receives B's code-change (reverse)", pushA !== null);

  // --- 4. cursor relay ---
  console.log("\n[4] cursors");
  const cursorPromise = once(
    bobSock,
    "cursor-change",
    (p) => p.userId === aliceJoin.you.userId && p.cursor?.line === 4 && p.cursor?.ch === 9,
    5000
  );
  await sleep(150);
  aliceSock.emit("cursor-change", { line: 4, ch: 9 });
  const cursorPush = await cursorPromise;
  check(
    "B receives A's cursor with color + name",
    cursorPush !== null && Boolean(cursorPush.color) && cursorPush.name === "Alice RT"
  );

  // --- 5. language sync ---
  console.log("\n[5] language sync");
  const langPromise = once(bobSock, "language-change", (p) => p.language === "cpp", 5000);
  await sleep(150);
  const langAck = await emitAck(aliceSock, "language-change", { language: "cpp" });
  const langPush = await langPromise;
  check("language-change acked + broadcast to B", langAck.ok === true && langPush !== null);

  // --- 6. chat + persistence ---
  console.log("\n[6] chat");
  const chatPromise = once(bobSock, "chat:message", (m) => m.content === "hello from A", 5000);
  await sleep(150);
  const chatAck = await emitAck(aliceSock, "chat:message", { content: "hello from A" });
  const chatPush = await chatPromise;
  check(
    "chat ack returns persisted message (id + name)",
    chatAck.ok === true && Boolean(chatAck.message?.id) && chatAck.message?.name === "Alice RT"
  );
  check("B receives chat:message live", chatPush !== null);

  // --- 7. typing ---
  console.log("\n[7] typing");
  const typingPromise = once(bobSock, "typing", (p) => p.typing === true && p.name === "Alice RT", 5000);
  await sleep(150);
  aliceSock.emit("typing", { typing: true });
  const typingPush = await typingPromise;
  check("B receives A's typing indicator", typingPush !== null);

  // --- 8. presence cleanup on disconnect ---
  console.log("\n[8] presence cleanup");
  const gonePromise = once(
    aliceSock,
    "presence:update",
    (list) => Array.isArray(list) && !list.some((p) => p.userId === bobJoin.you?.userId),
    8000
  );
  await sleep(150);
  bobSock.disconnect();
  const gone = await gonePromise;
  check("B removed from A's presence after disconnect", gone !== null);

  // --- 9. security ---
  console.log("\n[9] security");
  const eve = await register("Eve Sneak");
  const eveSock = socketFor(eve.cookie);
  const eveJoin = await emitAck(eveSock, "join-room", { roomId: room.id });
  check("non-member join rejected (no leak)", eveJoin.ok === false && eveJoin.error === "Room not found.");

  const eveCode = await emitAck(eveSock, "join-room", { code: "ZZZZ99" });
  check("join by bogus code rejected", eveCode.ok === false);

  const anon = socketFor("coderoom_session=bogus.token.here");
  const anonJoin = await emitAck(anon, "join-room", { roomId: room.id });
  check("unauthenticated join rejected", anonJoin.ok === false && /auth/i.test(String(anonJoin.error)));

  const evePatch = await fetch(`${BASE}/api/rooms/${room.id}/code`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: eve.cookie },
    body: JSON.stringify({ code: "hacked" }),
  });
  check("non-member autosave PATCH rejected", evePatch.status === 404);

  // --- 10. persistence across reconnect ---
  console.log("\n[10] persistence");
  await sleep(2000); // let the code flusher write
  const aliceSock2 = socketFor(alice.cookie);
  const rejoin = await emitAck(aliceSock2, "join-room", { roomId: room.id });
  check(
    "code change persisted to DB",
    rejoin.ok === true && String(rejoin.state?.room?.code ?? "").includes("bob reply"),
    `code=${JSON.stringify(rejoin.state?.room?.code?.slice(0, 30))}`
  );
  check(
    "chat history persisted",
    rejoin.ok === true && rejoin.state?.messages?.some((m) => m.content === "hello from A")
  );
  check(
    "language change persisted (cpp)",
    rejoin.ok === true && rejoin.state?.room?.language === "cpp"
  );
  check(
    "presence includes A after rejoin",
    rejoin.ok === true && rejoin.state?.presence?.some((p) => p.userId === aliceJoin.you.userId)
  );

  aliceSock.disconnect();
  aliceSock2.disconnect();
  eveSock.disconnect();
  anon.disconnect();

  console.log(`\n===== RESULTS: ${passCount} passed, ${failCount} failed =====`);
  if (failures.length) console.log("Failed:", failures.join(" | "));
  process.exit(failCount === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("test runner crashed:", e);
  process.exit(1);
});
