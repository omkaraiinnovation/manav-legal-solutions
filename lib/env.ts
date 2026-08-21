/**
 * Trimmed accessors for the two LLM provider API keys. Every call site that
 * needs a key goes through here rather than reading process.env directly.
 *
 * Why this exists: a real production incident. A key pasted into Vercel's
 * environment-variable UI carried a trailing newline character, which
 * Node's fetch correctly rejects as an illegal HTTP header value ("Bearer
 * sk-...\n is not a legal HTTP header value") — surfacing as an opaque
 * "Connection error." from the OpenAI SDK with no indication the key itself
 * was the problem. Trimming here means a stray newline/space from a
 * copy-paste can never silently break every AI call in this app again.
 */

export function getOpenAiApiKey(): string | undefined {
  const raw = process.env.OPENAI_API_KEY?.trim();
  return raw ? raw : undefined;
}

export function getAnthropicApiKey(): string | undefined {
  const raw = process.env.ANTHROPIC_API_KEY?.trim();
  return raw ? raw : undefined;
}
