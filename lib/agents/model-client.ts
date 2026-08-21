/**
 * Pluggable AI layer — supports both Anthropic (Claude) and OpenAI (GPT).
 *
 * Every agent in lib/agents calls `completeText()`, never an SDK directly.
 * Provider selection: MLS_LLM_PROVIDER env var ("anthropic" | "openai"), or
 * auto-detected from whichever API key is present (Anthropic preferred if
 * both are set, since it was configured first on this deployment). When
 * NEITHER key is set, callers fall back to their own deterministic mock
 * implementation — see isLiveMode() and lib/agents/*-agent.ts.
 */
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { getAnthropicApiKey, getOpenAiApiKey } from "@/lib/env";

export interface ModelMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CompleteOptions {
  system: string;
  messages: ModelMessage[];
  model?: "primary" | "verifier";
  maxTokens?: number;
}

export type LlmProvider = "anthropic" | "openai";

export function activeProvider(): LlmProvider | null {
  const forced = process.env.MLS_LLM_PROVIDER as LlmProvider | undefined;
  if (forced === "anthropic" || forced === "openai") return forced;
  if (getAnthropicApiKey()) return "anthropic";
  if (getOpenAiApiKey()) return "openai";
  return null;
}

export function isLiveMode(): boolean {
  return activeProvider() !== null;
}

let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: getAnthropicApiKey() });
  return anthropicClient;
}

let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: getOpenAiApiKey() });
  return openaiClient;
}

const ANTHROPIC_MODEL_IDS = {
  primary: process.env.MLS_MODEL_PRIMARY_ANTHROPIC || "claude-sonnet-5",
  verifier: process.env.MLS_MODEL_VERIFIER_ANTHROPIC || "claude-haiku-4-5-20251001",
};
const OPENAI_MODEL_IDS = {
  primary: process.env.MLS_MODEL_PRIMARY_OPENAI || "gpt-4o",
  verifier: process.env.MLS_MODEL_VERIFIER_OPENAI || "gpt-4o-mini",
};

export async function completeText(opts: CompleteOptions): Promise<string> {
  const provider = activeProvider();
  if (!provider) {
    throw new Error(
      "completeText() called with no LLM provider configured. Callers must check isLiveMode() and fall back to their own mock implementation — see lib/agents/*-agent.ts."
    );
  }

  if (provider === "anthropic") {
    const res = await getAnthropicClient().messages.create({
      model: ANTHROPIC_MODEL_IDS[opts.model ?? "primary"],
      max_tokens: opts.maxTokens ?? 2000,
      system: opts.system,
      messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
      // Explicitly disabled: this model defaults to adaptive extended
      // thinking, which consumes max_tokens on reasoning before any text is
      // emitted. With the modest budgets these agents use for structured
      // legal-triage/drafting output (1200-2000 tokens), that reliably ate
      // the entire budget and returned an empty reply with stop_reason
      // "max_tokens" and zero text blocks — see completeText()'s diagnostic
      // log below, which is what caught this in production.
      thinking: { type: "disabled" },
    });
    const textBlocks = res.content.filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text");
    const text = textBlocks.map((b) => b.text).join("");
    if (!text) {
      // Diagnostic only — never throws. Helps distinguish "model produced no
      // text block at all" (e.g. stopped mid-thinking on max_tokens) from
      // "text block present but empty", without logging any request content.
      console.error(
        "[model-client] Anthropic response yielded no text.",
        JSON.stringify({ stopReason: res.stop_reason, blockTypes: res.content.map((b) => b.type), usage: res.usage })
      );
    }
    return text;
  }

  // OpenAI
  const res = await getOpenAIClient().chat.completions.create({
    model: OPENAI_MODEL_IDS[opts.model ?? "primary"],
    max_tokens: opts.maxTokens ?? 2000,
    messages: [{ role: "system", content: opts.system }, ...opts.messages.map((m) => ({ role: m.role, content: m.content }))],
  });
  return res.choices[0]?.message?.content ?? "";
}
