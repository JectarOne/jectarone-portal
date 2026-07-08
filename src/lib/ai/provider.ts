import "server-only";
import { logger } from "@/lib/logger";

// Provider-agnostic LLM layer. Supports Anthropic and OpenAI, selected by env.
// Falls back to a deterministic "mock" provider when unconfigured so local dev,
// CI, and tests run without API keys.

export type AiProvider = "anthropic" | "openai" | "mock";

export function aiProvider(): AiProvider {
  const p = (process.env.AI_PROVIDER ?? "").toLowerCase();
  if (p === "anthropic" || p === "openai" || p === "mock") return p;
  // No explicit provider: use whichever key is present, else mock.
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "mock";
}

/** True when a real provider is configured (has a usable API key). */
export function aiConfigured(): boolean {
  const p = aiProvider();
  if (p === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY);
  if (p === "openai") return Boolean(process.env.OPENAI_API_KEY);
  return process.env.AI_PROVIDER === "mock"; // mock only counts as "configured" when explicit
}

export type CompleteInput = { system: string; user: string; maxTokens?: number };
export type CompleteResult = { text: string; provider: AiProvider; refused?: boolean };

const DEFAULT_MAX_TOKENS = 1500;

/** Single-shot completion. Never throws for provider/refusal issues — returns a result. */
export async function complete(input: CompleteInput): Promise<CompleteResult> {
  const provider = aiProvider();
  const maxTokens = input.maxTokens ?? DEFAULT_MAX_TOKENS;
  try {
    if (provider === "anthropic") return await completeAnthropic(input, maxTokens);
    if (provider === "openai") return await completeOpenAI(input, maxTokens);
    return completeMock(input);
  } catch (err) {
    logger.error("AI completion failed", err, { provider });
    return { text: "", provider, refused: false };
  }
}

async function completeAnthropic(input: CompleteInput, maxTokens: number): Promise<CompleteResult> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
  const resp = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: input.system,
    messages: [{ role: "user", content: input.user }],
  });
  // Safety classifiers may decline security-adjacent content — handle gracefully.
  if (resp.stop_reason === "refusal") {
    return { text: "", provider: "anthropic", refused: true };
  }
  const text = resp.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return { text, provider: "anthropic" };
}

async function completeOpenAI(input: CompleteInput, maxTokens: number): Promise<CompleteResult> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const resp = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
  });
  const choice = resp.choices[0];
  if (choice?.finish_reason === "content_filter") {
    return { text: "", provider: "openai", refused: true };
  }
  return { text: (choice?.message?.content ?? "").trim(), provider: "openai" };
}

/**
 * Deterministic offline provider. Echoes a clearly-labelled, non-fabricated
 * transformation of the input so tests can assert behaviour without a network
 * call. It never invents vulnerabilities — it only reflects the given text.
 */
function completeMock(input: CompleteInput): CompleteResult {
  const firstLine = input.user.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
  return {
    text: `[AI mock] ${firstLine.slice(0, 280)}`.trim(),
    provider: "mock",
  };
}
