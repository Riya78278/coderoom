/**
 * Phase 8 acceptance tests — AI interviewer (no API key spent).
 * Run with the server already up (build + start, or dev):
 *   node scripts/test-phase8.mjs
 *
 * Covers: auth + membership security on both AI routes, graceful 503 when
 * OPENAI_API_KEY is missing, and correct error shapes. (Live OpenAI behavior
 * is not tested here to keep the suite free and deterministic.)
 */
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
  console.log(`\n== CodeRoom Phase 8 test suite ==\n(base: ${BASE})\n`);

  const user = await register("Ai Tester");
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  const problem = await db.problem.findUnique({ where: { slug: "two-sum" } });

  const roomRes = await api(user.cookie, "POST", "/api/rooms", {
    name: `AI room ${rand}`,
    language: "javascript",
    problemId: problem.id,
  });
  const { room } = await roomRes.json();
  check("room created", Boolean(room?.id));

  // --- 1. security ---
  console.log("\n[1] security");
  const guestHint = await fetch(`${BASE}/api/ai/hint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId: room.id }),
  });
  check("guest hint rejected (401)", guestHint.status === 401);

  const eve = await register("Eve Ai");
  const outsiderHint = await api(eve.cookie, "POST", "/api/ai/hint", { roomId: room.id });
  check("non-member hint rejected (404)", outsiderHint.status === 404);

  const badBody = await api(user.cookie, "POST", "/api/ai/hint", { roomId: "nope" });
  check("invalid body rejected (400)", badBody.status === 400);

  // --- 2. graceful degradation without OPENAI_API_KEY ---
  // (test servers run without the key; if a key IS configured, accept 200)
  console.log("\n[2] graceful degradation");
  const hintRes = await api(user.cookie, "POST", "/api/ai/hint", { roomId: room.id });
  const hintData = await hintRes.json().catch(() => null);
  check(
    "hint: 503-unconfigured or 200-with-key",
    hintRes.status === 503 || (hintRes.status === 200 && typeof hintData?.hint === "string"),
    String(hintRes.status)
  );
  if (hintRes.status === 503) {
    check(
      "hint 503 message is actionable",
      String(hintData?.error ?? "").includes("OPENAI_API_KEY"),
      hintData?.error ?? ""
    );
  }

  // create a completed interview for the feedback route
  const peer = await register("Ai Peer");
  await api(peer.cookie, "POST", "/api/rooms/join", { code: room.joinCode });
  const intRes = await api(user.cookie, "POST", `/api/rooms/${room.id}/interview`, {
    candidateId: peer.id,
  });
  check("interview started", intRes.status === 201);
  const { interview } = await intRes.json();
  const endRes = await api(user.cookie, "PATCH", `/api/rooms/${room.id}/interview`, {
    rating: 4,
  });
  check("interview ended", endRes.status === 200);

  const fbOutsider = await api(eve.cookie, "POST", `/api/ai/feedback/${interview.id}`);
  check("feedback non-interviewer rejected (404)", fbOutsider.status === 404);

  const fbRes = await api(user.cookie, "POST", `/api/ai/feedback/${interview.id}`);
  const fbData = await fbRes.json().catch(() => null);
  check(
    "feedback: 503-unconfigured or 200-saved",
    fbRes.status === 503 || (fbRes.status === 200 && typeof fbData?.interview?.aiFeedback === "string"),
    String(fbRes.status)
  );
  const fbAgain = await api(user.cookie, "POST", `/api/ai/feedback/doesnotexist`);
  check("feedback unknown id rejected (404)", fbAgain.status === 404);

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
