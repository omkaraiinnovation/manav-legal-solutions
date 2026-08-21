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
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

export function isLiveMode(): boolean {
  return activeProvider() !== null;
}

let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropicClient;
}

let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
    });
    const block = res.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text : "";
  }

  // OpenAI
  const res = await getOpenAIClient().chat.completions.create({
    model: OPENAI_MODEL_IDS[opts.model ?? "primary"],
    max_tokens: opts.maxTokens ?? 2000,
    messages: [{ role: "system", content: opts.system }, ...opts.messages.map((m) => ({ role: m.role, content: m.content }))],
  });
  return res.choices[0]?.message?.content ?? "";
}
