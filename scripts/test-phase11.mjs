/**
 * Phase 11 acceptance tests — Redis scale-out.
 *
 * Boots TWO CodeRoom instances against one Redis, then verifies:
 *  - cross-instance code sync (A types on :3101, B sees it on :3102)
 *  - cross-instance chat
 *  - cross-instance presence (each side sees the other in the participant list)
 *  - presence cleanup after disconnect (TTL/set removal)
 *  - single-node mode unaffected (no REDIS_URL → same tests pass) — optional
 *
 * Usage:
 *   node scripts/test-phase11.mjs            (boots its own servers + redis)
 *   KEEP=1 node scripts/test-phase11.mjs     (leave processes running)
 */
import { io } from "socket.io-client";
import { spawn } from "node:child_process";

const REDIS_PORT = 6399; // avoid clashing with a real local redis on 6379
const REDIS_URL = `redis://localhost:${REDIS_PORT}`;
const A_PORT = 3101;
const B_PORT = 3102;
const rand = Math.random().toString(36).slice(2, 8);

let passCount = 0;
let failCount = 0;
const failures = [];
const children = [];

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

function wait(ms, promise) {
  return Promise.race([promise, sleep(ms).then(() => null)]);
}

async function register(base, name) {
  const email = `${name.toLowerCase().replace(/\s+/g, "")}${rand}@test.dev`;
  const res = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password: "Password123!" }),
  });
  if (res.status !== 201) throw new Error(`register failed: ${res.status}`);
  const body = await res.json();
  return {
    id: body.user.id,
    name,
    cookie: res.headers.get("set-cookie")?.split(";")[0],
  };
}

function connectSocket(base, cookie) {
  const token = cookie.split("=").slice(1).join("=");
  const sock = io(base, {
    path: "/api/socketio",
    transports: ["websocket"],
    auth: { token },
  });
  const presenceUpdates = [];
  // Attach BEFORE joining so no cross-instance update is missed.
  sock.on("presence:update", (list) => presenceUpdates.push(list));
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("join timeout")), 15000);
    sock.on("connect", () => {
      sock.emit("join-room", { roomId: ROOM_ID }, (res) => {
        clearTimeout(t);
        if (res?.ok) resolve({ sock, ackState: res.state, presenceUpdates });
        else reject(new Error(res?.error ?? "join failed"));
      });
    });
  });
}

let ROOM_ID = null;

async function main() {
  console.log("\n== CodeRoom Phase 11 test suite (two instances + Redis) ==\n");

  // 1. boot redis
  console.log("[0] booting redis + two instances");
  children.push(
    spawn("redis-server", ["--port", String(REDIS_PORT), "--save", "", "--appendonly", "no"], {
      stdio: "ignore",
    })
  );
  await sleep(800);

  const env = { ...process.env, NODE_ENV: "production", REDIS_URL, INTERNAL_BROADCAST_SECRET: "dev-internal" };
  children.push(spawn("node", ["server.mjs"], { env: { ...env, PORT: String(A_PORT) }, stdio: "ignore" }));
  children.push(spawn("node", ["server.mjs"], { env: { ...env, PORT: String(B_PORT) }, stdio: "ignore" }));

  // wait for both
  for (const port of [A_PORT, B_PORT]) {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) {
      try {
        const r = await fetch(`http://localhost:${port}/`);
        up = r.ok;
      } catch {}
      if (!up) await sleep(500);
    }
    if (!up) throw new Error(`server on :${port} never came up`);
  }
  console.log(`  ✓ both instances up (A=:${A_PORT}, B=:${B_PORT}) with Redis :${REDIS_PORT}`);

  const baseA = `http://localhost:${A_PORT}`;
  const baseB = `http://localhost:${B_PORT}`;

  // 2. create room via A, register users on different instances
  const host = await register(baseA, "Host On A");
  const guest = await register(baseB, "Guest On B");

  // find the two-sum problem through instance A
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  const problem = await db.problem.findUnique({ where: { slug: "two-sum" } });

  const roomRes = await fetch(`${baseA}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: host.cookie },
    body: JSON.stringify({ name: `Scale room ${rand}`, language: "javascript", problemId: problem.id }),
  });
  const { room } = await roomRes.json();
  ROOM_ID = room.id;
  check("room created on instance A", Boolean(room?.id));

  // guest joins via B (HTTP join API — shared Neon DB, either instance sees it)
  const joinRes = await fetch(`${baseB}/api/rooms/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: guest.cookie },
    body: JSON.stringify({ code: room.joinCode }),
  });
  check("guest joined via instance B", joinRes.status === 200 || joinRes.status === 201);

  // 3. sockets: host connects to A, guest connects to B
  const { sock: sockA, presenceUpdates: updatesA } = await connectSocket(baseA, host.cookie);
  const { sock: sockB, ackState: stateB, presenceUpdates: updatesB } = await connectSocket(baseB, guest.cookie);
  await sleep(800); // let presence cross-propagate

  // --- cross-instance presence ---
  console.log("\n[1] cross-instance presence");
  check(
    "B's join-ack presence (from Redis) includes host on A",
    Array.isArray(stateB?.presence) && stateB.presence.some((p) => p.userId === host.id),
    JSON.stringify(stateB?.presence)?.slice(0, 120)
  );
  check(
    "A received a presence:update event including guest on B",
    updatesA.some((list) => Array.isArray(list) && list.some((p) => p.userId === guest.id)),
    JSON.stringify(updatesA)?.slice(0, 120)
  );
  const lastA = updatesA[updatesA.length - 1] ?? [];
  check(
    "A's latest presence snapshot still includes itself",
    Array.isArray(lastA) && lastA.some((p) => p.userId === host.id),
    JSON.stringify(lastA)?.slice(0, 120)
  );

  // --- cross-instance code sync ---
  console.log("\n[2] cross-instance code sync");
  let remoteCode = null;
  sockB.on("code-change", (p) => {
    remoteCode = p;
  });
  sockA.emit("code-change", { code: `// cross-instance hello ${rand}` });
  await wait(5000, new Promise((resolve) => {
    const iv = setInterval(() => {
      if (remoteCode) {
        clearInterval(iv);
        resolve();
      }
    }, 200);
  }));
  check(
    "code typed on A arrives on B",
    remoteCode?.code === `// cross-instance hello ${rand}`,
    JSON.stringify(remoteCode)?.slice(0, 100)
  );

  // --- cross-instance chat ---
  console.log("\n[3] cross-instance chat");
  let chatOnA = null;
  sockA.on("chat:message", (m) => {
    chatOnA = m;
  });
  await new Promise((resolve) => {
    sockB.emit("chat:message", { content: `hello from B ${rand}` }, () => resolve());
  });
  await wait(5000, new Promise((resolve) => {
    const iv = setInterval(() => {
      if (chatOnA) {
        clearInterval(iv);
        resolve();
      }
    }, 200);
  }));
  check(
    "chat sent on B arrives on A",
    chatOnA?.content === `hello from B ${rand}`,
    JSON.stringify(chatOnA)?.slice(0, 100)
  );

  // --- presence cleanup after disconnect ---
  console.log("\n[4] presence cleanup");
  sockB.disconnect();
  await wait(6000, new Promise((resolve) => {
    const iv = setInterval(() => {
      const last = updatesA[updatesA.length - 1];
      if (last && !last.some((p) => p.userId === guest.id)) {
        clearInterval(iv);
        resolve();
      }
    }, 300);
  }));
  const finalA = updatesA[updatesA.length - 1] ?? [];
  check(
    "guest disappears from A's presence after disconnect",
    Array.isArray(finalA) && !finalA.some((p) => p.userId === guest.id),
    JSON.stringify(finalA)?.slice(0, 120)
  );

  sockA.disconnect();

  // 4. cleanup
  console.log("\n[5] cleanup");
  for (const c of children) c.kill("SIGTERM");
  try {
    const { execSync } = await import("node:child_process");
    execSync(`${"redis-cli"} -p ${REDIS_PORT} shutdown nosave 2>/dev/null || true`);
  } catch {}
  await db.$disconnect();

  console.log(`\n===== RESULTS: ${passCount} passed, ${failCount} failed =====`);
  if (failures.length) {
    console.log("Failed:", failures.join(" | "));
    process.exit(1);
  }
  process.exit(0);
}

main().catch(async (e) => {
  console.error("test runner crashed:", e);
  for (const c of children) c.kill("SIGTERM");
  process.exit(1);
});
