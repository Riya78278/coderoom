"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

export type PresenceUser = {
  userId: string;
  name: string;
  color: string;
  cursor: { line: number; ch: number; sid: string } | null;
};

export type ChatMessage = {
  id: string;
  content: string;
  userId: string;
  name: string;
  createdAt: string;
};

type JoinAck = {
  ok: boolean;
  error?: string;
  state?: {
    room: { id: string; name: string; joinCode: string; language: string; code: string; status: string };
    messages: ChatMessage[];
    presence: PresenceUser[];
  };
  you?: { sid: string; color: string; role: string; userId: string };
};

type JoinState = "connecting" | "joined" | "error";

/**
 * Manages the room's real-time connection: join + auth, presence list,
 * remote code/language updates (seq-stamped so effects fire exactly once),
 * chat with history, and typing indicators.
 */
export function useRoomSocket(roomId: string) {
  const [status, setStatus] = useState<JoinState>("connecting");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [initialCode, setInitialCode] = useState<string | null>(null);
  const [initialLanguage, setInitialLanguage] = useState<string | null>(null);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [remoteTyping, setRemoteTyping] = useState<
    Record<string, { name: string; at: number }>
  >({});
  const [remoteCode, setRemoteCode] = useState<{ code: string; seq: number } | null>(
    null
  );
  const [remoteLanguage, setRemoteLanguage] = useState<{
    language: string;
    seq: number;
  } | null>(null);
  const [me, setMe] = useState<{
    sid: string;
    color: string;
    role: string;
    userId: string;
  } | null>(null);
  const [interviewEvent, setInterviewEvent] = useState<{
    action: "started" | "ended";
    interviewId: string | null;
    name: string;
    seq: number;
  } | null>(null);
  const [submissionEvent, setSubmissionEvent] = useState<{
    submissionId: string;
    userId: string;
    name: string;
    verdict: string;
    passed: number;
    total: number;
    runtimeMs: number | null;
    at: string;
    seq: number;
  } | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    const socket = io({ path: "/api/socketio", addTrailingSlash: false });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join-room", { roomId }, (res: JoinAck) => {
        if (res?.ok && res.state) {
          setInitialCode(res.state.room.code);
          setInitialLanguage(res.state.room.language);
          setMessages(res.state.messages);
          setPresence(res.state.presence);
          setMe(res.you ?? null);
          setStatus("joined");
        } else {
          setStatus("error");
          setJoinError(res?.error ?? "Could not join the room.");
        }
      });
    });

    socket.on("connect_error", () => {
      setStatus((s) => (s === "joined" ? s : "error"));
      setJoinError((e) => e ?? "Could not reach the real-time server.");
    });

    socket.on("presence:update", (list: PresenceUser[]) => {
      setPresence(list);
    });

    socket.on("code-change", (p: { code: string }) => {
      seqRef.current += 1;
      setRemoteCode({ code: p.code, seq: seqRef.current });
    });

    socket.on("language-change", (p: { language: string }) => {
      seqRef.current += 1;
      setRemoteLanguage({ language: p.language, seq: seqRef.current });
    });

    socket.on("cursor-change", (p: PresenceUser) => {
      setPresence((prev) => {
        const idx = prev.findIndex((u) => u.userId === p.userId);
        if (idx === -1) return prev; // presence snapshot will catch up
        const next = [...prev];
        next[idx] = { ...next[idx], cursor: p.cursor, color: p.color };
        return next;
      });
    });

    socket.on("chat:message", (m: ChatMessage) => {
      setMessages((prev) => [...prev, m]);
      setRemoteTyping((prev) => {
        if (!(m.userId in prev)) return prev;
        const next = { ...prev };
        delete next[m.userId];
        return next;
      });
    });

    socket.on("interview:update", (p: { action: "started" | "ended"; interviewId: string | null; name: string }) => {
      seqRef.current += 1;
      setInterviewEvent({ ...p, seq: seqRef.current });
    });

    socket.on("submission:result", (p: { submissionId: string; userId: string; name: string; verdict: string; passed: number; total: number; runtimeMs: number | null; at: string }) => {
      seqRef.current += 1;
      setSubmissionEvent({ ...p, seq: seqRef.current });
    });

    socket.on("typing", (p: { userId: string; name: string; typing: boolean }) => {
      setRemoteTyping((prev) => {
        const next = { ...prev };
        if (p.typing) next[p.userId] = { name: p.name, at: Date.now() };
        else delete next[p.userId];
        return next;
      });
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId]);

  // Typing indicators expire after 3s of silence.
  useEffect(() => {
    const t = setInterval(() => {
      setRemoteTyping((prev) => {
        const now = Date.now();
        let changed = false;
        const next: typeof prev = {};
        for (const [userId, v] of Object.entries(prev)) {
          if (now - v.at < 3000) next[userId] = v;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const sendCodeChange = useCallback((code: string) => {
    socketRef.current?.emit("code-change", { code });
  }, []);

  const sendCursorChange = useCallback((line: number, ch: number) => {
    socketRef.current?.emit("cursor-change", { line, ch });
  }, []);

  const sendLanguageChange = useCallback((language: string) => {
    socketRef.current?.emit("language-change", { language });
  }, []);

  const sendTyping = useCallback((typing: boolean) => {
    socketRef.current?.emit("typing", { typing });
  }, []);

  const sendChatMessage = useCallback(
    (content: string) =>
      new Promise<{ ok: boolean; message?: ChatMessage }>((resolve) => {
        const s = socketRef.current;
        if (!s) {
          resolve({ ok: false });
          return;
        }
        s.emit("chat:message", { content }, (res: { ok: boolean; message?: ChatMessage }) =>
          resolve(res ?? { ok: false })
        );
      }),
    []
  );

  return {
    status,
    joinError,
    initialCode,
    initialLanguage,
    presence,
    messages,
    remoteTyping,
    remoteCode,
    remoteLanguage,
    me,
    interviewEvent,
    submissionEvent,
    sendCodeChange,
    sendCursorChange,
    sendLanguageChange,
    sendTyping,
    sendChatMessage,
  };
}
