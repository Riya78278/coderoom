"use client";

import { useEffect, useMemo, useRef } from "react";
import Editor, { type OnMount, type Monaco } from "@monaco-editor/react";

export type RemoteCursor = {
  userId: string;
  name: string;
  color: string;
  cursor: { line: number; ch: number } | null;
};

export type CodeEditorProps = {
  value: string;
  language: string;
  onChange: (value: string) => void;
  onCursorChange?: (line: number, ch: number) => void;
  remoteCursors?: RemoteCursor[];
  readOnly?: boolean;
};

type DecorationSpec = {
  range: unknown;
  options: Record<string, unknown>;
};

/** Monaco editor wrapper with remote named cursors (Phase 4). */
export function CodeEditor({
  value,
  language,
  onChange,
  onCursorChange,
  remoteCursors = [],
  readOnly,
}: CodeEditorProps) {
  // Structural types keep this file free of `any` while staying simple.
  const editorRef = useRef<{
    deltaDecorations: (old: string[], next: DecorationSpec[]) => string[];
    getModel: () => {
      getLineMaxColumn: (line: number) => number;
    } | null;
    onDidChangeCursorPosition: (cb: (e: { position: { lineNumber: number; column: number } }) => void) => unknown;
  } | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);

  const options = useMemo(
    () => ({
      fontSize: 13.5,
      fontFamily:
        "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      padding: { top: 14, bottom: 14 },
      renderLineHighlight: "line" as const,
      readOnly: readOnly ?? false,
      tabSize: 2,
      cursorBlinking: "smooth" as const,
    }),
    [readOnly]
  );

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor as unknown as NonNullable<typeof editorRef.current>;
    monacoRef.current = monaco;
    editor.focus();

    editor.onDidChangeCursorPosition((e) => {
      onCursorChangeRef.current?.(
        e.position.lineNumber - 1,
        e.position.column - 1
      );
    });
  };

  const onCursorChangeRef = useRef(onCursorChange);
  onCursorChangeRef.current = onCursorChange;

  // Render remote cursors as named decorations (the live-collab look).
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;

    const next: DecorationSpec[] = [];
    for (const rc of remoteCursors) {
      if (!rc.cursor) continue;
      const line = Math.min(Math.max(1, rc.cursor.line + 1), 100_000);
      const maxCol = model.getLineMaxColumn(line);
      const col = Math.min(Math.max(1, rc.cursor.ch + 1), maxCol);
      const id = rc.userId.replace(/[^a-z0-9]/gi, "");
      next.push({
        range: new monaco.Range(line, col, line, col),
        options: {
          className: `remote-cursor remote-cursor-${id}`,
          beforeContentClassName: `remote-caret remote-caret-${id}`,
          hoverMessage: { value: `**${rc.name}**` },
          stickiness: 1,
        },
      });
    }
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, next);
  }, [remoteCursors, value]);

  // Per-user caret colors + name chips via injected CSS rules.
  useEffect(() => {
    if (typeof document === "undefined") return;
    let style = document.getElementById("remote-cursor-styles");
    if (!style) {
      style = document.createElement("style");
      style.id = "remote-cursor-styles";
      document.head.appendChild(style);
    }
    const rules = remoteCursors
      .filter((rc) => rc.cursor)
      .map((rc) => {
        const id = rc.userId.replace(/[^a-z0-9]/gi, "");
        return (
          `.remote-caret-${id}{border-left-color:${rc.color}!important;}` +
          `.remote-cursor-${id}::after{content:"${rc.name.replace(/"/g, "")}";background:${rc.color};}`
        );
      })
      .join("\n");
    style.textContent = rules;
  }, [remoteCursors]);

  return (
    <div className="h-full min-h-0 bg-navy-950">
      <Editor
        height="100%"
        theme="vs-dark"
        language={language}
        value={value}
        onChange={(v) => onChangeRef.current(v ?? "")}
        onMount={handleMount}
        options={options}
        loading={
          <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
            <span className="text-xs font-medium">Loading editor…</span>
          </div>
        }
      />
    </div>
  );
}
