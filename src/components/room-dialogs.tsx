"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ProblemOption = { id: string; title: string; difficulty: string };

const LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
] as const;

/* ---------------- Shared modal shell ---------------- */

function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="card w-full max-w-md p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
            <p className="mt-0.5 text-sm text-slate-600">{description}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------------- Create Room dialog ---------------- */

function CreateRoomDialog({
  problems,
  onClose,
}: {
  problems: ProblemOption[];
  onClose: (createdCode?: string) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<string>("javascript");
  const [problemId, setProblemId] = useState<string>("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "PUBLIC">("PRIVATE");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          language,
          problemId: problemId || null,
          visibility,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not create the room. Please try again.");
        return;
      }
      onClose();
      router.push(`/room/${data.room.id}`);
      router.refresh();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Create a room"
      description="You'll become the host and get a code to share."
      onClose={() => onClose()}
    >
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="room-name" className="label">Room name</label>
          <input
            id="room-name"
            className="input"
            placeholder="e.g. Mock interview — arrays"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={3}
            maxLength={60}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="room-language" className="label">Language</label>
            <select
              id="room-language"
              className="input"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="room-visibility" className="label">Visibility</label>
            <select
              id="room-visibility"
              className="input"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "PRIVATE" | "PUBLIC")}
            >
              <option value="PRIVATE">Private — code to join</option>
              <option value="PUBLIC">Public</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="room-problem" className="label">
            Problem <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <select
            id="room-problem"
            className="input"
            value={problemId}
            onChange={(e) => setProblemId(e.target.value)}
          >
            <option value="">No problem — blank slate</option>
            {problems.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} · {p.difficulty.toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={() => onClose()} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? "Creating…" : "Create room"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- Join Room dialog ---------------- */

function JoinRoomDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not join. Please try again.");
        return;
      }
      onClose();
      router.push(`/room/${data.room.id}`);
      router.refresh();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Join a room"
      description="Enter the 6-character code your host shared."
      onClose={onClose}
    >
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="join-code" className="label">Room code</label>
          <input
            id="join-code"
            className="input text-center font-mono text-lg font-semibold uppercase tracking-[0.3em]"
            placeholder="XXX-XXX"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={7}
            autoFocus
            required
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? "Joining…" : "Join room"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- Buttons that open the dialogs ---------------- */

export function RoomDialogs({
  problems,
  size = "md",
}: {
  problems: ProblemOption[];
  size?: "md" | "sm";
}) {
  const [dialog, setDialog] = useState<"create" | "join" | null>(null);

  // Sidebar links point at /dashboard?action=create|join — open on arrival,
  // then scrub the param so a refresh doesn't re-open the dialog.
  useEffect(() => {
    const action = new URLSearchParams(window.location.search).get("action");
    if (action === "create" || action === "join") {
      setDialog(action);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  return (
    <>
      <div className="flex gap-3">
        <button
          onClick={() => setDialog("create")}
          className={`btn-primary ${size === "sm" ? "px-3 py-2 text-xs" : ""}`}
        >
          + Create Room
        </button>
        <button
          onClick={() => setDialog("join")}
          className={`btn-secondary ${size === "sm" ? "px-3 py-2 text-xs" : ""}`}
        >
          Join Room
        </button>
      </div>

      {dialog === "create" && (
        <CreateRoomDialog problems={problems} onClose={() => setDialog(null)} />
      )}
      {dialog === "join" && <JoinRoomDialog onClose={() => setDialog(null)} />}
    </>
  );
}
