/**
 * CodeRoom custom server — Next.js + Socket.IO on one port (plain JS).
 *
 * Why a custom server: Socket.IO needs a plain HTTP server to attach to;
 * Next.js alone can't host WebSockets. One process serves both, so dev and
 * production stay identical. (Render hosts this fine; Vercel wouldn't.)
 *
 * NOTE: JWT verification is duplicated here (vs src/lib/session-token.ts)
 * because this file must run as plain JavaScript without a TS loader.
 * SESSION_COOKIE / secret / TTL must stay in sync.
 *
 * Real-time contract (Phase 4):
 *   client → server: join-room, leave-room, code-change, cursor-change,
 *                    language-change, chat:message, typing
 *   server → client: room-state (join ack), presence:update, code-change,
 *                    cursor-change, language-change, chat:message, typing
 *
 * Phase 11 upgrade path: swap the in-memory socketsMeta Map for Redis
 * pub/sub (socket.io-redis-adapter) — event names and payloads stay the same.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { Server as SocketIOServer } from "socket.io";
import next from "next";
import { PrismaClient } from "@prisma/client";
import { jwtVerify } from "jose";

// Load .env before anything reads DATABASE_URL / AUTH_SECRET
// (Next's own loader runs inside prepare(), which is too late for Prisma).
try {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
    }
  }
} catch {}

const dev = process.env.NODE_ENV !== "production";
// Tolerate missing/empty/garbage PORT (Render sets a real one; local shells
// sometimes export an empty string, which Number() turns into 0).
const parsedPort = Number(process.env.PORT);
const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 3000;

/* --- Session verification (keep in sync with session-token.ts) --- */
const SESSION_COOKIE = "coderoom_session";
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-only-insecure-secret-change-me"
);
async function verifySessionToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      name: String(payload.name ?? ""),
      email: String(payload.email ?? ""),
      exp: payload.exp ?? 0,
    };
  } catch {
    return null;
  }
}

/* --- Join-code + language helpers (keep in sync with src/lib) --- */
function normalizeJoinCode(raw) {
  return String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
}
const LANGUAGE_VALUES = ["javascript", "python", "java", "cpp"];
function isRoomLanguage(value) {
  return LANGUAGE_VALUES.includes(value);
}

const db = new PrismaClient();
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();
await nextApp.prepare();

const httpServer = createServer((req, res) => {
  // Internal broadcast bridge (Phase 6): route handlers POST here so their
  // results reach every socket in a room. Guarded by a shared secret.
  if (req.url === "/api/internal/broadcast" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      try {
        const parsed = JSON.parse(body || "{}");
        if (!INTERNAL_SECRET || parsed.secret !== INTERNAL_SECRET) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: "Unauthorized" }));
          return;
        }
        const { roomId, event, payload } = parsed;
        if (typeof roomId !== "string" || typeof event !== "string") {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "Bad payload" }));
          return;
        }
        const receivers = io.to(roomId).emit(event, payload);
        console.log(
          `[broadcast] ${event} → room ${roomId} (${receivers ?? "?"} sockets)`
        );
        res.end(JSON.stringify({ ok: true, receivers }));
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Bad JSON" }));
      }
    });
    return;
  }
  handle(req, res);
});

const io = new SocketIOServer(httpServer, {
  cors: { origin: true, credentials: true },
  path: "/api/socketio",
  addTrailingSlash: false,
});

// Expose io to Next route handlers running in this same process (Phase 6).
// Route handlers prefer this direct emit; the HTTP bridge below stays as a
// fallback. One process hosts both, so the global is always the same io.
globalThis.__coderoomIO = io;

// Shared secret for the internal broadcast bridge (route handlers → sockets).
// Dev gets a known default so local runs work out of the box; production
// must set INTERNAL_BROADCAST_SECRET explicitly.
const INTERNAL_SECRET =
  process.env.INTERNAL_BROADCAST_SECRET ?? (dev ? "dev-internal" : undefined);

/* ---------------------------------------------------------------------- */
/* Presence tracking                                                      */
/* ---------------------------------------------------------------------- */

/** socket.id → meta. One user may hold several sockets (multi-tab). */
const socketsMeta = new Map();

const CURSOR_COLORS = [
  "#818cf8", "#34d399", "#fbbf24", "#f87171",
  "#38bdf8", "#c084fc", "#f472b6", "#4ade80",
];

function colorForRoomMember(roomId, userId) {
  let hash = 0;
  const key = `${roomId}:${userId}`;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
}

let sidCounter = 0;
function nextSid() {
  sidCounter += 1;
  return `sid_${Date.now().toString(36)}_${sidCounter}`;
}

/** Presence snapshot of a room, de-duped by user (multi-tab safe). */
function roomPresenceSnapshot(roomId) {
  const byUser = new Map();
  for (const meta of socketsMeta.values()) {
    if (meta.roomId !== roomId) continue;
    const existing = byUser.get(meta.userId);
    if (!existing) {
      byUser.set(meta.userId, {
        userId: meta.userId,
        name: meta.name,
        color: meta.color,
        cursor: meta.cursor ? { ...meta.cursor } : null,
      });
    } else if (meta.cursor) {
      if (!existing.cursor || meta.cursor.sid >= existing.cursor.sid) {
        existing.cursor = { ...meta.cursor };
      }
    }
  }
  return [...byUser.values()];
}

function emitPresence(roomId) {
  io.to(roomId).emit("presence:update", roomPresenceSnapshot(roomId));
}

/* ---------------------------------------------------------------------- */
/* Room state payload (sent on join)                                      */
/* ---------------------------------------------------------------------- */

async function buildRoomStatePayload(roomId) {
  const [room, messages] = await Promise.all([
    db.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        name: true,
        joinCode: true,
        language: true,
        code: true,
        status: true,
      },
    }),
    db.message.findMany({
      where: { roomId },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);
  if (!room) return null;
  return {
    room,
    messages: messages.reverse(),
    presence: roomPresenceSnapshot(roomId),
  };
}

/* ---------------------------------------------------------------------- */
/* Code write coalescer                                                   */
/* Buffers the latest code per room and flushes to Postgres at most every  */
/* 1.5s, so fast typing doesn't hammer Neon with an UPDATE per keystroke. */
/* ---------------------------------------------------------------------- */

const pendingCodeFlush = new Map(); // roomId → { code, language, timer }
const CODE_FLUSH_MS = 1500;

function queueCodeFlush(roomId, code, language) {
  let entry = pendingCodeFlush.get(roomId);
  if (!entry) {
    entry = { code, language, timer: null };
    pendingCodeFlush.set(roomId, entry);
  } else {
    entry.code = code;
    if (language) entry.language = language;
  }
  if (!entry.timer) {
    entry.timer = setTimeout(() => {
      entry.timer = null;
      void flushCode(roomId);
    }, CODE_FLUSH_MS);
  }
}

async function flushCode(roomId) {
  const entry = pendingCodeFlush.get(roomId);
  if (!entry) return;
  pendingCodeFlush.delete(roomId);
  if (entry.timer) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }
  try {
    await db.room.update({
      where: { id: roomId },
      data: {
        code: entry.code,
        ...(entry.language ? { language: entry.language } : {}),
      },
    });
  } catch (error) {
    console.error("[socket] code flush failed:", error);
    queueCodeFlush(roomId, entry.code, entry.language); // retry next cycle
  }
}

/** Called on shutdown so buffered code is never lost. */
async function flushAllCode() {
  for (const id of [...pendingCodeFlush.keys()]) {
    await flushCode(id);
  }
}

function shutdown(code) {
  void flushAllCode()
    .catch(() => undefined)
    .finally(() => {
      void db.$disconnect();
      process.exit(code);
    });
}
process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));

/* ---------------------------------------------------------------------- */
/* Helpers                                                                */
/* ---------------------------------------------------------------------- */

function parseCookieValue(cookieHeader, name) {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return part.slice(eq + 1).trim();
      }
    }
  }
  return undefined;
}

const CUID_RE = /^c[a-z0-9]{20,}$/i;

/* ---------------------------------------------------------------------- */
/* Socket handlers                                                        */
/* join-room does the security work: JWT → user, DB → membership check.   */
/* ---------------------------------------------------------------------- */

io.on("connection", (socket) => {
  let meta = null; // SocketMeta — set by join-room

  socket.on("join-room", async (raw, ack) => {
    try {
      if (typeof raw !== "object" || raw === null) {
        ack?.({ ok: false, error: "Invalid payload." });
        return;
      }
      const body = raw;

      // 1. Authenticate: session cookie first, then handshake.auth.token
      //    (the token path keeps Node-based test clients simple).
      const cookieToken = parseCookieValue(
        socket.handshake.headers.cookie,
        SESSION_COOKIE
      );
      const authToken =
        typeof socket.handshake.auth?.token === "string"
          ? socket.handshake.auth.token
          : undefined;
      const payload = await verifySessionToken(cookieToken ?? authToken);
      if (!payload) {
        ack?.({ ok: false, error: "Authentication required." });
        return;
      }

      // 2. Find the room by id or join code.
      const roomIdStr = typeof body.roomId === "string" ? body.roomId.trim() : "";
      const codeStr = typeof body.code === "string" ? normalizeJoinCode(body.code) : "";
      if (!roomIdStr && !codeStr) {
        ack?.({ ok: false, error: "Room not found." });
        return;
      }
      const room = await db.room.findFirst({
        where: {
          OR: [
            ...(roomIdStr && CUID_RE.test(roomIdStr) ? [{ id: roomIdStr }] : []),
            ...(codeStr ? [{ joinCode: codeStr }] : []),
          ],
          status: "ACTIVE",
        },
        select: { id: true },
      });
      if (!room) {
        ack?.({ ok: false, error: "Room not found." });
        return;
      }

      // 3. Authorize: must be a member (fresh DB check on every join).
      const membership = await db.roomMember.findUnique({
        where: { roomId_userId: { roomId: room.id, userId: payload.id } },
        select: { role: true },
      });
      if (!membership) {
        // Same answer as for a missing room — don't leak existence.
        ack?.({ ok: false, error: "Room not found." });
        return;
      }

      // 4. Leave a previous room if this socket is switching rooms.
      if (meta?.roomId) {
        const prev = meta.roomId;
        socket.leave(prev);
        socketsMeta.delete(socket.id);
        emitPresence(prev);
      }

      const sid = nextSid();
      meta = {
        userId: payload.id,
        name: payload.name,
        color: colorForRoomMember(room.id, payload.id),
        roomId: room.id,
        cursor: null,
        sid,
      };
      socketsMeta.set(socket.id, meta);
      socket.join(room.id);

      const state = await buildRoomStatePayload(room.id);
      if (!state) {
        ack?.({ ok: false, error: "Room not found." });
        return;
      }

      ack?.({
        ok: true,
        state,
        you: { sid, color: meta.color, role: membership.role, userId: payload.id },
      });
      socket.to(room.id).emit("presence:update", roomPresenceSnapshot(room.id));
    } catch (error) {
      console.error("[socket] join-room failed:", error);
      ack?.({ ok: false, error: "Could not join the room." });
    }
  });  socket.on("code-change", (raw) => {
    if (!meta?.roomId) return;
    if (typeof raw !== "object" || raw === null) return;
    const { code } = raw;
    if (typeof code !== "string" || code.length > 100_000) return;
    const language = typeof raw.language === "string" ? raw.language : null;
    queueCodeFlush(meta.roomId, code, language);
    socket.to(meta.roomId).emit("code-change", {
      code,
      from: meta.userId,
      name: meta.name,
    });
  });

  socket.on("cursor-change", (raw) => {
    if (!meta?.roomId) return;
    if (typeof raw !== "object" || raw === null) return;
    const { line, ch } = raw;
    if (
      typeof line !== "number" ||
      typeof ch !== "number" ||
      !Number.isFinite(line) ||
      !Number.isFinite(ch) ||
      line < 0 ||
      ch < 0 ||
      line > 100_000 ||
      ch > 100_000
    ) {
      return;
    }
    meta.cursor = { line, ch, sid: meta.sid };
    socket.to(meta.roomId).emit("cursor-change", {
      userId: meta.userId,
      name: meta.name,
      color: meta.color,
      cursor: meta.cursor,
    });
  });

  socket.on("language-change", async (raw, ack) => {
    if (!meta?.roomId) {
      ack?.({ ok: false });
      return;
    }
    if (typeof raw !== "object" || raw === null) {
      ack?.({ ok: false });
      return;
    }
    const language = raw.language;
    if (typeof language !== "string" || !isRoomLanguage(language)) {
      ack?.({ ok: false });
      return;
    }
    try {
      await db.room.update({
        where: { id: meta.roomId },
        data: { language },
      });
    } catch (error) {
      console.error("[socket] language change failed:", error);
      ack?.({ ok: false });
      return;
    }
    // Align any buffered code flush so it doesn't resurrect the old language.
    const entry = pendingCodeFlush.get(meta.roomId);
    if (entry) entry.language = language;
    ack?.({ ok: true });
    io.to(meta.roomId).emit("language-change", { language });
  });

  socket.on("chat:message", async (raw, ack) => {
    if (!meta?.roomId) {
      ack?.({ ok: false });
      return;
    }
    if (typeof raw !== "object" || raw === null) {
      ack?.({ ok: false });
      return;
    }
    const content = String(raw.content ?? "")
      .trim()
      .slice(0, 2000);
    if (!content) {
      ack?.({ ok: false });
      return;
    }
    try {
      const message = await db.message.create({
        data: { roomId: meta.roomId, userId: meta.userId, content },
      });
      const payload = {
        id: message.id,
        content,
        userId: meta.userId,
        name: meta.name,
        createdAt: message.createdAt.toISOString(),
      };
      io.to(meta.roomId).emit("chat:message", payload);
      ack?.({ ok: true, message: payload });
    } catch (error) {
      console.error("[socket] chat save failed:", error);
      ack?.({ ok: false });
    }
  });

  socket.on("typing", (raw) => {
    if (!meta?.roomId) return;
    if (typeof raw !== "object" || raw === null) return;
    const typing = Boolean(raw.typing);
    socket.to(meta.roomId).emit("typing", {
      userId: meta.userId,
      name: meta.name,
      typing,
    });
  });

  // Phase 5: interview lifecycle relay (the DB is authoritative via the
  // REST API; this just notifies everyone in the room instantly).
  socket.on("interview:update", (raw) => {
    if (!meta?.roomId) return;
    if (typeof raw !== "object" || raw === null) return;
    const action = raw.action;
    if (action !== "started" && action !== "ended") return;
    socket.to(meta.roomId).emit("interview:update", {
      action,
      interviewId: typeof raw.interviewId === "string" ? raw.interviewId : null,
      by: meta.userId,
      name: meta.name,
    });
  });

  socket.on("leave-room", () => {
    if (!meta?.roomId) return;
    const roomId = meta.roomId;
    socket.leave(roomId);
    socketsMeta.delete(socket.id);
    meta = null;
    emitPresence(roomId);
  });

  socket.on("disconnect", () => {
    if (!meta?.roomId) return;
    const roomId = meta.roomId;
    socketsMeta.delete(socket.id);
    emitPresence(roomId);
  });
});

httpServer.listen(port, () => {
  console.log(
    `> CodeRoom ready on http://localhost:${port} ${dev ? "(dev)" : "(prod)"}`
  );
});
