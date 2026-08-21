/**
 * Q&A Agent — Retrieval-Augmented Generation over a matter's uploaded
 * documents AND the legal knowledge base together (spec Sections 6, 10, 11).
 *
 * Document Upload → Parsing → Chunking → Embedding → Vector Storage →
 * Semantic Retrieval → Context Assembly → LLM Analysis → Source-Grounded Answer
 *
 * The answer is never generated without retrieved context: if there are no
 * document chunks AND no relevant provisions, the agent returns an explicit
 * "insufficient information" result rather than asking the LLM to guess.
 */
import { DocumentChunks, KnowledgeBaseSearch, type QaSource } from "@/lib/db/documents-repo";
import { embedText, embeddingsAvailable } from "./embeddings";
import { completeText, isLiveMode, activeProvider } from "./model-client";
import { STANDARD_DISCLAIMER } from "./prompts";
import { Acts } from "@/lib/db/repo";

export interface QaAnswer {
  answer: string;
  sources: QaSource[];
  confidence: "grounded" | "partial" | "insufficient";
  modelUsed: string;
}

const SIMILARITY_FLOOR = 0.55; // below this cosine similarity, a chunk is treated as noise, not a real match

export async function answerMatterQuestion(matterId: string, question: string): Promise<QaAnswer> {
  if (!embeddingsAvailable()) {
    return {
      answer:
        "Semantic search over uploaded documents requires OPENAI_API_KEY to be configured (it powers the embeddings used for retrieval). Once it's set, ask this question again and I'll search the matter's actual documents. [VERIFICATION REQUIRED: Source Not Confirmed]",
      sources: [],
      confidence: "insufficient",
      modelUsed: "none",
    };
  }

  const queryEmbedding = await embedText(question);

  const [docMatches, provisionMatches] = await Promise.all([
    DocumentChunks.semanticSearch(matterId, queryEmbedding, 8),
    KnowledgeBaseSearch.semanticSearchProvisions(queryEmbedding, 6),
  ]);

  const relevantDocChunks = docMatches.filter((m) => m.similarity >= SIMILARITY_FLOOR);
  const relevantProvisions = provisionMatches.filter((m) => m.similarity >= SIMILARITY_FLOOR);

  const sources: QaSource[] = [
    ...relevantDocChunks.map((m) => ({
      type: "document_chunk" as const, id: m.id,
      label: m.section_heading ? `Document — ${m.section_heading}${m.page_number ? ` (p.${m.page_number})` : ""}` : `Document chunk${m.page_number ? ` (p.${m.page_number})` : ""}`,
      snippet: m.content.slice(0, 400), page: m.page_number ?? undefined,
    })),
    ...relevantProvisions.map((m) => ({
      type: "provision" as const, id: m.id, label: `${m.act_id} s.${m.section_number} — ${m.title}`, snippet: m.text_content.slice(0, 400),
    })),
  ];

  if (sources.length === 0) {
    return {
      answer:
        "I couldn't find anything in this matter's uploaded documents or the seeded legal knowledge base that addresses this question. This may mean the relevant document hasn't been uploaded yet, or the answer requires research beyond what's currently ingested. [VERIFICATION REQUIRED: Further Jurisdiction-Specific Research Required]",
      sources: [],
      confidence: "insufficient",
      modelUsed: "none",
    };
  }

  if (!isLiveMode()) {
    // No LLM key at all (neither OpenAI nor Anthropic) — return the raw grounded excerpts
    // rather than fabricating prose, consistent with "no false completeness."
    const lines = [
      "No LLM is configured to synthesize a narrative answer (set OPENAI_API_KEY or ANTHROPIC_API_KEY), but here is what the retrieval step found, most relevant first:",
      "",
      ...sources.map((s, i) => `${i + 1}. **${s.label}** — "${s.snippet}${s.snippet.length >= 400 ? "…" : ""}"`),
    ];
    return { answer: lines.join("\n"), sources, confidence: "partial", modelUsed: "retrieval-only" };
  }

  const contextBlock = sources.map((s, i) => `[${i + 1}] (${s.type}) ${s.label}\n${s.snippet}`).join("\n\n");
  const system = `You are the Q&A engine of Manav Legal Solutions' paralegal platform. Answer the user's question STRICTLY from the numbered source excerpts below — never from general knowledge, and never invent a fact, date, section, or party name that isn't in the excerpts.

Rules:
- Cite sources inline using their [N] number for every factual claim.
- If the excerpts only partially answer the question, say so explicitly and identify exactly what's missing.
- If the excerpts don't answer the question at all, say clearly that the information is unavailable and further research/documents are required — do not guess.
- Keep the answer concise and structured (use short paragraphs or a numbered list).

[SOURCE EXCERPTS]
${contextBlock}`;

  const rawAnswer = await completeText({ system, messages: [{ role: "user", content: question }], model: "primary", maxTokens: 900 });

  const soundsInsufficient = /information is (unavailable|not available|insufficient)|cannot (be )?answer|no (relevant )?information/i.test(rawAnswer);
  const confidence: QaAnswer["confidence"] = soundsInsufficient ? "partial" : relevantDocChunks.length > 0 ? "grounded" : "partial";

  return {
    answer: `${rawAnswer}\n\n---\n*${STANDARD_DISCLAIMER}*`,
    sources,
    confidence,
    modelUsed: `${activeProvider()}`,
  };
}

// Re-exported for routes that need to check Act metadata alongside a Q&A answer (e.g. trust-level display).
export { Acts };
