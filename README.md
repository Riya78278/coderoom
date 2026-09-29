# CodeRoom — Collaborative Coding & Interview Platform

> A real-time collaborative coding platform where two or more people join the same room, solve a problem together, chat, and see each other's code and cursors change live — built for mock interviews and pair programming.

**Status: ✅ Phases 1–6 complete — code execution + grading verified (24/24 tests). Next: Phase 7 (deployment).**

**Scope: 12 phases — 10 mandatory for the complete product (0–7, 9, 11), 2 optional (8: AI interviewer, 10: notifications).**

---

## 1. Core Idea

```
                  CODE ROOM
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
    Problem       Editor        Chat
        │            │            │
        ↓            ↓            ↓
   Test Cases   Real-time      Messages
                 Changes
                     │
                     ↓
                Run / Submit
```

Example flow: an interviewer creates a room, a candidate joins via a room code, the interviewer assigns a problem, and both watch the candidate's code change in real time. Everything — code, chat, presence, session results — is persisted to PostgreSQL.

---

## 2. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | **Next.js (App Router) + React** | One codebase for UI + API |
| Language | **TypeScript** | Type safety across client, server, and sockets |
| Styling | **Tailwind CSS** | Fast, consistent UI |
| Code editor | **Monaco Editor** (`@monaco-editor/react`) | The VS Code editing experience in the browser |
| Database | **PostgreSQL (Neon, free tier)** | Relational data: users, rooms, members, messages |
| ORM | **Prisma** | Type-safe queries, migrations, relations |
| Real-time | **Socket.IO** (custom Node server) | Live code sync, cursors, chat, presence |
| Auth | **Auth.js (NextAuth) credentials** | Email + password in our own DB, no third-party account needed |
| Password hashing | **bcrypt** | Standard secure practice |
| Hosting (Phase 7) | **Render** (app) + **Neon** (DB) | Free tiers, WebSocket support, shareable URL |

Code execution (Phase 6), code replay (Phase 9), and Redis scale-out (Phase 11) are **mandatory** parts of the complete product. Only the AI interviewer (8) and notifications (10) are optional.

**One process runs everything:** `server.ts` boots Next.js and Socket.IO together, because Next.js alone cannot host persistent WebSocket connections (and Vercel cannot host them at all). This is why deployment targets Render/Railway/VPS/Docker rather than Vercel.

---

## 3. Project Architecture

```
                    ┌──────────────┐
                    │    Next.js   │
                    │   Frontend   │
                    └──────┬───────┘
                           │
              ┌────────────┴────────────┐
              ↓                         ↓
        REST / Server Actions      Socket.IO
        (auth, rooms, history)     (real-time channel)
              │                         │
              ↓                         ↓
        ┌─────────────┐          ┌─────────────┐
        │   Prisma    │          │  server.ts  │
        └──────┬──────┘          │ (same proc) │
               ↓                 └──────┬──────┘
        ┌─────────────┐                 │
        │  PostgreSQL │           (Redis shared bus,
        │  (Neon)     │            Phase 11)
        └─────────────┘
               │
               ↓
      Code Execution (Phase 6)
               │
               ↓
        Docker Sandbox (isolated, resource-limited)
```

### How a keystroke travels (the heart of the product)

```
Riya types in Monaco (browser A)
      │  "code-change" event (debounced ~100–200 ms)
      ↓
Socket.IO → server.ts (validates she's in the room)
      │  broadcast "code-change" to everyone else in room
      ↓
Rahul's Monaco (browser B) applies the change — no refresh
      │
      └── every ~5 s, the current document autosaves to
          Postgres via Prisma (survives disconnects/reloads)
```

- **Sync strategy:** debounced full-document broadcast. Simple and reliable for 2–4 people per room. (Upgrade path if ever needed: Yjs CRDT for true concurrent merging.)
- **Cursors:** each client emits `cursor-change` (line/col); remote cursors render as named colored decorations in Monaco — "Riya" on line 12, "Rahul" on line 25.
- **Presence:** `join-room` / `leave-room` / disconnect events maintain a live participant list per room.
- **Security:** user code is never executed inside the Next.js process. Execution (later phase) happens only in isolated containers with strict CPU, memory, time, filesystem, and network limits.

---

## 4. Folder Structure

```
collaborative coding platform project/
├─ README.md                 ← you are here
├─ server.ts                 # Next.js + Socket.IO in one process
├─ prisma/
│  └─ schema.prisma          # User, Room, RoomMember, Problem, ...
└─ src/
   ├─ app/
   │  ├─ (auth)/login        # login / register pages
   │  ├─ dashboard           # home after login
   │  ├─ room/[roomId]       # the core room page
   │  └─ api/                # REST endpoints / route handlers
   ├─ components/
   │  ├─ Editor.tsx          # Monaco wrapper
   │  ├─ ProblemPanel.tsx
   │  ├─ ChatPanel.tsx
   │  └─ ParticipantsBar.tsx
   ├─ lib/
   │  ├─ db.ts               # Prisma client
   │  ├─ auth.ts             # Auth.js config
   │  └─ socket-client.ts    # browser-side socket singleton
   └─ socket/
      └─ handlers.ts         # join/leave/code/cursor/chat/presence
```

---

## 5. Database Design

Start small; grow per phase. Solid relational modeling with foreign keys (PostgreSQL used properly, not like MongoDB).

**Phase 1–4 models:**

```
User ─┬─< RoomMember >─┬─ Room ─┬─< Message
      │                │        ├─< Submission        (Phase 6)
      │                │        └─< CodeSnapshot      (Phases 5 & 9)
      └─< Interview    (Phase 5) └─< CodeEvent         (Phase 9, replay)

Problem ─< Room          (a room works on one problem)
Problem ─< TestCase      (Phase 6, execution)
```

| Model | Key fields | Purpose |
|---|---|---|
| **User** | id, name, email (unique), passwordHash, image | Account + profile stats |
| **Room** | id, name, joinCode (6-char), creatorId → User, language, problemId → Problem, status (active/completed), visibility | The workspace |
| **RoomMember** | roomId, userId, role (host/participant/interviewer/candidate) | Who's in which room, with what role |
| **Problem** | id, title, slug, difficulty, description, constraints, examples (JSON), starterCode (JSON per language) | The problem bank |
| **TestCase** | problemId, input, expectedOutput, isSample | Phase 6 (execution) |
| **Message** | roomId, userId, content, createdAt | Persisted room chat |
| **Submission** | roomId, userId, language, code, passed/total, status | Phase 6 (execution) |
| **CodeSnapshot** | roomId, userId, content, takenAt | Session history / replay anchors |
| **Interview** | roomId, interviewerId, candidateId, startedAt, endedAt, result (JSON) | Interview mode |
| **CodeEvent** | roomId, userId, type (insert/delete), payload, timestamp | Code replay timeline |

---

## 6. Real-Time Event Contract (Socket.IO)

| Event | Direction | Payload | Notes |
|---|---|---|---|
| `join-room` | client → server | `{ roomId }` | Auth-checked; adds to socket room |
| `leave-room` | client → server | `{ roomId }` | On exit / unload |
| `presence:update` | server → room | `{ users: [{ id, name, color }] }` | Recomputed on join/leave/disconnect |
| `code-change` | both ways | `{ roomId, code, version }` | Debounced broadcast; originator skipped |
| `cursor-change` | both ways | `{ roomId, userId, line, column }` | Remote cursor decorations |
| `language-change` | both ways | `{ roomId, language }` | Synced editor language |
| `chat:message` | both ways | `{ roomId, content }` | Persisted to Postgres, then broadcast |
| `typing` | both ways | `{ roomId, userName }` | Ephemeral typing indicator |

Rules: every event is authenticated (session required) and room-membership-checked before broadcast. The server is the single source of truth for room membership.

---

## 7. Build Phases

Each phase ends with something demoable. Checkboxes track progress.

**Build order:** 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 9 → 11 · **Mandatory for the complete product:** 0–7, 9, 11 · **Optional:** 8, 10

### ✅ Phase 0 — Planning & Design *(this document)*
- [x] Product definition and MVP scope
- [x] Tech stack locked (Next.js + TS + Tailwind + Prisma + Postgres/Neon + Socket.IO + Auth.js)
- [x] Architecture and data-flow design
- [x] Database schema design
- [x] Real-time event contract
- [x] Deployment strategy (Render + Neon)
- [x] Scope locked: Phases 6 (execution), 9 (replay), 11 (Redis) are mandatory — 8 & 10 optional

### ✅ Phase 1 — Scaffold + Authentication *(verified end-to-end against Neon)*
**Goal:** a running app where you can register, log in, log out, and see a protected page.

**Implementation:**
1. ✅ Scaffolded Next.js 16 (App Router, TypeScript, Turbopack) + Tailwind v4.
2. ✅ Prisma + `User` model created; Neon `DATABASE_URL` in `.env`, migration `20260928105724_init` applied.
3. ✅ Register / login / logout API routes: bcrypt hashing, zod validation, signed JWT session cookie via an edge-safe token module.
4. ✅ Route protection with `proxy.ts` (Next 16's replacement for middleware): `/dashboard` + `/room/*` guarded; logged-in users redirected away from auth pages.
5. ✅ Polished UI: landing page (dark hero + live-editor mock with named cursors + features + how-it-works), split-screen login/register, dashboard shell with dark sidebar.

**Done when:** migrations run against Neon and two accounts can be created, sessions persist across refresh, protected routes bounce logged-out users. *(Verified: register 201 → login 200 → dashboard 200 with session; guest bounce 307.)*

### ✅ Phase 2 — Dashboard + Rooms *(verified with two users)*
**Goal:** create a room, share a 6-character code, join from another account.

**Implementation:**
1. Dashboard: "Welcome back, {name}", **Create Room** and **Join Room** actions, Recent Rooms list with status (Active/Completed).
2. Create Room form: name, language, problem (dropdown), visibility.
3. Room record + `RoomMember` (creator = host) via Prisma; unique 6-char `joinCode`.
4. Join flow by code; membership validation; member list per room.
5. `Room`/`RoomMember`/`Problem` models + seed a few starter problems (Two Sum, Reverse String, etc.).

**Done when:** User A creates a room, User B joins it by code, both see each other in the member list. *(Verified: A created room `GN55WE`, B joined → member list shows HOST + MEMBER; bad code → 404, guest create → 401, outsider room view → 404, dashed code format accepted via normalization.)*

### ✅ Phase 3 — Room Page + Editor *(verified: autosave persists across reloads)*
**Goal:** the three-panel room: problem • code editor • (placeholder chat).

**Implementation:**
1. Room layout: left = problem panel (title, difficulty badge, description, examples, constraints), center = editor, right = chat.
2. Monaco via `@monaco-editor/react` — **client-side only** (Monaco cannot server-render); dynamic import with loading state.
3. Language selector (C++, Java, Python, JavaScript) driving starter code per language from `Problem.starterCode` JSON.
4. Autosave: debounced document updates to Postgres; code survives reloads and reconnects.
5. Run/Submit buttons present but stubbed ("sandbox coming soon") — execution is deliberately deferred.

**Done when:** code typed in the room persists after refresh; language switch swaps starter code. *(Verified: starter code seeded on room creation, PATCH autosave returns 200, code + language survive a simulated reload, non-member save rejected.)*

### ✅ Phase 4 — Real-Time Collaboration (the heart) *(25/25 automated tests passed)*
**Goal:** two browsers in one room see each other's code, cursors, and chat live.

**Implementation:**
1. `server.mjs`: Next.js request handler + Socket.IO server in one process (plain JS — no TS loader needed); `npm run dev` / `npm start` both use it.
2. Browser socket singleton with auth; `join-room` on room page mount, cleanup on unmount.
3. Code sync per the event contract (debounced broadcast, server validates membership).
4. Remote cursors: `cursor-change` → Monaco decorations with name labels and per-user colors.
5. Presence: live participant list ("🟢 2 Participants"); typing indicators in chat.
6. Chat panel: `chat:message` persisted to `Message` table, then broadcast; history loads on join.

**Done when:** Riya types in one browser → Rahul sees it instantly in another, with named cursors and working chat. *(Verified by `node scripts/test-phase4.mjs`: 25/25 — join/auth, room-state, presence updates + cleanup, bidirectional code sync, cursor relay with name+color, language sync, chat persistence + history, typing, non-member/guest/bogus-code rejections, and code+chat+language persistence across reconnect.)*

### ✅ Phase 5 — Interview Mode + History *(25/25 automated tests passed)*
**Goal:** the feature that makes the project resume-worthy.

**Implementation:**
1. Roles: creator = **interviewer**, joiner = **candidate** (stored on `RoomMember`).
2. Session timer in the room header; interviewer controls (assign/switch problem).
3. End session → room status `completed`; snapshot final code (`CodeSnapshot`); write `Interview` record (duration, problem, participants).
4. Interview History page: past sessions with duration, problem, participants.
5. Profile stats: problems solved, mock interviews, rooms created.

**Done when:** a complete mock interview runs start to finish and appears in history with its summary. *(Verified by `node scripts/test-phase5.mjs`: 25/25 — host-only start, self/guest rejections, duplicate-start 409, live started/ended relays to the candidate, end-of-session code snapshot, room completed, history for both participants, snapshots visible on the detail page, outsider 404, post-completion locks.)*

### ✅ Phase 6 — Code Execution *(mandatory — 24/24 automated tests passed)*
**Goal:** Run and Submit really execute code and grade test cases — safely.

**Implementation:**
1. Execution adapter with pluggable backends (`EXECUTION_BACKEND` env): **Judge0 public CE** by default (no key needed), **Piston** kept as the alternative. User code never runs inside the Next.js process — it executes in the sandbox with per-case timeouts.
2. Universal test harness: each `TestCase` stores a JSON array of function arguments (e.g. `"[[2,7,11,15],9]"`); the harness appends a stdin-JSON runner that calls the user's function and compares against `expectedOutput` (JS + Python; Java/C++ return UNSUPPORTED for now).
3. `TestCase` live: **Run** executes the sample cases; **Submit** grades all of them. Hidden-case inputs/outputs are never shown — failures display as "✗ hidden". Grading stops at the first failing case (max 12). Verdicts: ACCEPTED / WRONG_ANSWER / RUNTIME_ERROR / TLE / UNSUPPORTED.
4. `Submission` persisted on submit: verdict, passed/total, runtime, per-case results; GET `/api/rooms/:id/submissions` shows room history (newest first).
5. Room UI: output panel with verdict badge + per-case rows; Run/Submit buttons in the workspace; results broadcast live to everyone in the room (direct in-process Socket.IO emit, HTTP bridge fallback).
6. Security: auth required, membership checked; no execution in COMPLETED rooms.

**Done when:** Run shows sample-test output, Submit grades hidden tests, and results persist and display for all participants. *(Verified by `node scripts/test-phase6.mjs`: 24/24 — guest/non-member rejection, run-uses-3-samples-only, submit grades all 5 and persists, correct solution ACCEPTED, wrong answer on hidden case with inputs masked, runtime error surfaced, infinite loop → TLE, newest-first history, and live `submission:result` received by a second room member.)*

### ⬜ Phase 7 — Deployment
**Goal:** one public URL to share.

1. Push to GitHub.
2. Render web service from the repo; env vars: `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`/`AUTH_URL`, `PORT`.
3. Neon stays the database (free, no expiry — Render's own free DB expires after 30 days, hence the split).
4. Result: `https://coderoom-xxxx.onrender.com`.
5. Free-tier caveat: server sleeps after 15 min idle (~30–60 s cold start); optional UptimeRobot keep-alive ping while actively sharing.

### ⬜ Phase 9 — Code Replay *(mandatory)*
**Goal:** scrub through any finished session and watch the solution being written, decision by decision.

**Implementation:**
1. Record a `CodeEvent` timeline during rooms: periodic full snapshots + diffs between them (keeps rows small).
2. Interleave chat messages and run/submit moments into the same timeline.
3. Replay page: code viewer + scrubber (play / pause / speed), following the candidate's progress minute by minute.
4. Link each replay from the Interview History page.

**Done when:** you can open a completed session and replay how the code evolved end to end.

### ⬜ Phase 11 — Redis Scale-Out *(mandatory)*
**Goal:** multiple server instances without breaking real-time sync.

**Implementation:**
1. Add Redis (Upstash free tier or local) via `@socket.io/redis-adapter`: every broadcast publishes through Redis so **all** instances deliver it — the fix for the "Riya on Server 1, Rahul on Server 2" problem.
2. Move presence and room membership from in-memory maps to Redis with TTL heartbeats.
3. Run 2+ app instances behind a load balancer and verify cross-instance rooms.

**Done when:** two participants on two different server instances, same room, still see each other's code, cursors, and chat instantly.

### ⬜ Optional Phases
| Phase | Feature | Approach |
|---|---|---|
| 8 | **AI interviewer** | OpenAI API: approach questions, hints, post-session feedback (communication, complexity, code quality) |
| 10 | **Notifications** | Joins, invites, messages, assigned problems |

---

## 8. Acceptance Checklists

**MVP (Phases 1–5):**
```
Login → Dashboard → Create Room → Join Room (2nd account) →
Problem visible → Monaco editor → Real-time code sync →
Shared cursors → Live chat → End session → History saved
```

**Complete product (adds Phases 6, 7, 9, 11):**
```
Run (sample tests) → Submit (hidden tests, graded) →
Live public URL on Render → Replay any finished session →
Two app instances synced through Redis
```

When both chains work reliably — locally first, then on the deployed URL — the product is complete per the agreed scope (only the AI interviewer and notifications would remain, by choice).

---

## 9. Local Development (once Phase 1 is executed)

```bash
npm install
npx prisma migrate dev      # needs DATABASE_URL in .env
npm run dev:all             # runs server.ts (Next + Socket.IO)
# app on http://localhost:3000
```

Environment variables (`.env`, never committed):

```
DATABASE_URL="postgresql://...neon.tech/..."
AUTH_SECRET="..."
```
