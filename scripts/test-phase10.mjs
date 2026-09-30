/**
 * Phase 10 acceptance tests — notifications.
 * Run with the server already up (build + start, or dev):
 *   node scripts/test-phase10.mjs
 *
 * Covers: security, JOIN notification to host on member join, CHAT
 * notification for offline members, INTERVIEW + PROBLEM notifications,
 * live socket push to the user channel, mark-one/mark-all read.
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

async function waitFor(fn, ms = 8000, step = 300) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const v = await fn();
    if (v) return v;
    await sleep(step);
  }
  return null;
}

async function main() {
  console.log(`\n== CodeRoom Phase 10 test suite ==\n(base: ${BASE})\n`);

  // --- 1. security ---
  console.log("\n[1] security");
  const guest = await fetch(`${BASE}/api/notifications`);
  check("guest notifications rejected (401)", guest.status === 401);

  const host = await register("Host Bell");
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  const problem = await db.problem.findUnique({ where: { slug: "two-sum" } });

  const roomRes = await api(host.cookie, "POST", "/api/rooms", {
    name: `Notify room ${rand}`,
    language: "javascript",
    problemId: problem.id,
  });
  const { room } = await roomRes.json();
  check("room created", Boolean(room?.id));

  // host listens on the personal channel BEFORE the join happens
  const hostToken = host.cookie.split("=").slice(1).join("=");
  const hostSock = io(BASE, {
    path: "/api/socketio",
    transports: ["websocket"],
    auth: { token: hostToken },
  });
  const liveNotifications = [];
  hostSock.on("notification", (n) => liveNotifications.push(n));
  await sleep(400);

  // --- 2. JOIN notification (member → host) ---
  console.log("\n[2] join notification");
  const member = await register("Member Arrives");
  const joinRes = await api(member.cookie, "POST", "/api/rooms/join", { code: room.joinCode });
  check("member joined", joinRes.status === 200 || joinRes.status === 201);

  const joinNote = await waitFor(() =>
    liveNotifications.find((n) => n.type === "JOIN" && n.actorName === "Member Arrives")
  );
  check(
    "host got LIVE join notification",
    Boolean(joinNote),
    JSON.stringify(liveNotifications.map((n) => n.type))?.slice(0, 80)
  );
  const joinInDb = await waitFor(() =>
    db.notification.findFirst({ where: { userId: host.id, type: "JOIN" } })
  );
  check("join notification persisted", Boolean(joinInDb));

  // --- 3. CHAT notification for OFFLINE members ---
  console.log("\n[3] chat notification (offline member)");
  // member posts chat; host is online (socket joined room? no — host socket
  // never joined the room, so host counts as offline for chat → expects one)
  const memberToken = member.cookie.split("=").slice(1).join("=");
  const memberSock = io(BASE, {
    path: "/api/socketio",
    transports: ["websocket"],
    auth: { token: memberToken },
  });
  await new Promise((resolve) => {
    memberSock.emit("join-room", { roomId: room.id }, () => resolve());
  });
  await sleep(300);
  await new Promise((resolve) => {
    memberSock.emit("chat:message", { content: `ping ${rand}` }, () => resolve());
  });

  const chatNote = await waitFor(() =>
    db.notification.findFirst({
      where: { userId: host.id, type: "CHAT" },
      orderBy: { createdAt: "desc" },
    })
  );
  check(
    "offline host got chat notification",
    Boolean(chatNote) && chatNote.content === undefined,
    chatNote ? "" : "no CHAT row"
  );
  check(
    "chat notification mentions sender + text",
    Boolean(chatNote?.title.includes("Member Arrives") && chatNote.title.includes(`ping ${rand}`)),
    chatNote?.title ?? ""
  );
  memberSock.disconnect();

  // --- 4. PROBLEM notification (host assigns → members) ---
  // NOTE: before the interview test — ending an interview completes the room,
  // which would block the problem assignment (404).
  console.log("\n[4] problem notification");
  const probRes = await api(host.cookie, "PATCH", `/api/rooms/${room.id}/problem`, {
    problemId: problem.id,
  });
  check("problem assigned", probRes.status === 200, String(probRes.status));
  const probNote = await waitFor(() =>
    db.notification.findFirst({ where: { userId: member.id, type: "PROBLEM" } })
  );
  check("member got problem notification", Boolean(probNote));

  // --- 5. INTERVIEW notification (candidate) ---
  console.log("\n[5] interview notification");
  const intRes = await api(host.cookie, "POST", `/api/rooms/${room.id}/interview`, {
    candidateId: member.id,
  });
  check("interview started", intRes.status === 201, String(intRes.status));
  const intNote = await waitFor(() =>
    db.notification.findFirst({ where: { userId: member.id, type: "INTERVIEW" } })
  );
  check("candidate got interview notification", Boolean(intNote));

  // end it so the room stays usable
  await api(host.cookie, "PATCH", `/api/rooms/${room.id}/interview`, { rating: 5 });

  // --- 6. read state ---
  console.log("\n[6] read state");
  const list1 = await api(host.cookie, "GET", "/api/notifications");
  const list1Data = await list1.json();
  check("list returns unread count > 0", (list1Data?.unread ?? 0) > 0, String(list1Data?.unread));
  check("list returns latest items", Array.isArray(list1Data?.latest) && list1Data.latest.length > 0);

  const markAll = await api(host.cookie, "PATCH", "/api/notifications", { markRead: "all" });
  check("mark-all works", markAll.status === 200);
  const list2 = await api(host.cookie, "GET", "/api/notifications");
  const list2Data = await list2.json();
  check("unread is 0 after mark-all", list2Data?.unread === 0, String(list2Data?.unread));

  const badPatch = await api(host.cookie, "PATCH", "/api/notifications", { markRead: "one" });
  check("mark-one without id rejected (400)", badPatch.status === 400);

  hostSock.disconnect();
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
