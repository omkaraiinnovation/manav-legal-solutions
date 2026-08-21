/**
 * Embeddings for RAG. OpenAI's text-embedding-3-small (1536 dims, matching
 * the pgvector column width in the schema) is the only wired provider —
 * Anthropic has no embeddings API. If OPENAI_API_KEY isn't set, embedding
 * calls throw a clear, typed error rather than silently returning fake
 * vectors; callers (upload pipeline, Q&A route) surface that as a real error
 * state in the UI instead of pretending RAG ran.
 */
import OpenAI from "openai";

export class EmbeddingsUnavailableError extends Error {
  constructor() {
    super("OPENAI_API_KEY is not configured — embeddings (and therefore document RAG search) are unavailable until it's set.");
    this.name = "EmbeddingsUnavailableError";
  }
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new EmbeddingsUnavailableError();
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export function embeddingsAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

const EMBEDDING_MODEL = "text-embedding-3-small";
const MAX_BATCH = 96; // OpenAI batch embedding limit headroom

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const c = getClient();
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += MAX_BATCH) {
    const batch = texts.slice(i, i + MAX_BATCH).map((t) => t.slice(0, 8000)); // stay under the model's token limit
    const res = await c.embeddings.create({ model: EMBEDDING_MODEL, input: batch });
    results.push(...res.data.map((d) => d.embedding));
  }
  return results;
}

export async function embedText(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  return embedding;
}
