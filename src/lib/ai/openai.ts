/**
 * Phase 8 — AI interviewer (OpenAI).
 *
 * Uses plain fetch (no SDK). When OPENAI_API_KEY is unset the AI features
 * degrade gracefully: routes return 503 with a clear message instead of
 * failing. Never log the key; never include it in errors.
 */
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export class AINotConfiguredError extends Error {
  constructor() {
    super("AI features are disabled — OPENAI_API_KEY is not configured.");
    this.name = "AINotConfiguredError";
  }
}

export function aiEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function chatCompletion(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new AINotConfiguredError();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: opts.maxTokens ?? 400,
        temperature: opts.temperature ?? 0.4,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`OpenAI responded ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("OpenAI returned an empty response.");
    return content;
  } finally {
    clearTimeout(timer);
  }
}
