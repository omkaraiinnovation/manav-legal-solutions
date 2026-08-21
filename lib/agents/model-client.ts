/**
 * Pluggable AI layer.
 *
 * Every agent in lib/agents calls `completeText()` / `streamText()` from here,
 * never the Anthropic SDK directly. When ANTHROPIC_API_KEY is unset (the
 * default for this build), calls are routed to `runMock()`, a deterministic,
 * rule-based responder that only ever uses content already present in the
 * seeded knowledge base — it never fabricates a citation. Set the env var and
 * every agent switches to live Claude calls with no code changes.
 */
import Anthropic from "@anthropic-ai/sdk";

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

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export function isLiveMode(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const MODEL_IDS = {
  primary: process.env.MLS_MODEL_PRIMARY || "claude-sonnet-5",
  verifier: process.env.MLS_MODEL_VERIFIER || "claude-haiku-4-5-20251001",
};

export async function completeText(opts: CompleteOptions): Promise<string> {
  const c = getClient();
  if (!c) {
    throw new Error(
      "completeText() called without a live client. Callers must check isLiveMode() and fall back to their own mock implementation — see lib/agents/*-agent.ts for the pattern."
    );
  }
  const res = await c.messages.create({
    model: MODEL_IDS[opts.model ?? "primary"],
    max_tokens: opts.maxTokens ?? 2000,
    system: opts.system,
    messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
  });
  const block = res.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}
