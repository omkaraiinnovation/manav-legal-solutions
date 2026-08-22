/**
 * Evidence Intelligence Agent (spec §17). Builds a fact matrix from the
 * client narrative + every parsed document on a matter together, then
 * cross-references it for contradictions, unsupported allegations, and
 * duplicate documents — turning the matter from a document pile into
 * something that understands what each document is actually claiming.
 *
 * Every fact is source-cited back to a real document/page or the client
 * narrative; nothing here is presented without a traceable origin. When no
 * LLM is configured, this returns a plain notice rather than fabricating an
 * analysis — the same "No False Completeness" rule as every other agent.
 */
import type { DocumentRecord } from "@/lib/db/documents-repo";
import { completeText, isLiveMode, activeProvider } from "./model-client";
import type { EvidenceFact, EvidenceFactSource, EvidenceContradiction, EvidenceMissingSupport, EvidenceDuplicate } from "@/lib/db/evidence-repo";

export interface EvidenceAnalysisResult {
  facts: EvidenceFact[];
  contradictions: EvidenceContradiction[];
  missingSupport: EvidenceMissingSupport[];
  duplicates: EvidenceDuplicate[];
  modelUsed: string;
}

const MAX_CHARS_PER_DOCUMENT = 6000; // keeps a multi-document request within the model's context/output budget
const MAX_DOCUMENTS = 12;

export async function runEvidenceAnalysis(matterFacts: string, documents: DocumentRecord[]): Promise<EvidenceAnalysisResult> {
  const parsedDocs = documents.filter((d) => d.status === "parsed" && d.extractedText?.trim()).slice(0, MAX_DOCUMENTS);

  if (!isLiveMode()) {
    return {
      facts: [],
      contradictions: [],
      missingSupport: [{ allegation: "Evidence analysis unavailable", note: "Set ANTHROPIC_API_KEY or OPENAI_API_KEY to enable fact-matrix extraction and contradiction detection — this requires an LLM, not just retrieval." }],
      duplicates: [],
      modelUsed: "none",
    };
  }

  if (!matterFacts.trim() && parsedDocs.length === 0) {
    return {
      facts: [],
      contradictions: [],
      missingSupport: [{ allegation: "No material to analyze", note: "Add matter facts and/or upload documents before running evidence analysis." }],
      duplicates: [],
      modelUsed: "none",
    };
  }

  // DOC1..DOCn labels, not real UUIDs — the model can't be trusted with IDs it
  // never saw verbatim, so it cites these labels and we map them back below.
  const refMap = new Map<string, DocumentRecord>();
  const sourceBlocks: string[] = [];
  if (matterFacts.trim()) {
    sourceBlocks.push(`[NARRATIVE — client-provided facts]\n${matterFacts.trim()}`);
  }
  parsedDocs.forEach((doc, i) => {
    const label = `DOC${i + 1}`;
    refMap.set(label, doc);
    const text = (doc.extractedText ?? "").slice(0, MAX_CHARS_PER_DOCUMENT);
    const truncatedNote = (doc.extractedText?.length ?? 0) > MAX_CHARS_PER_DOCUMENT ? " [truncated for analysis]" : "";
    sourceBlocks.push(`[${label} — ${doc.fileName}${doc.lowConfidence ? ", low-confidence extraction" : ""}]\n${text}${truncatedNote}`);
  });

  const system = `You are the Evidence Intelligence engine of an Indian legal paralegal platform. Given a client's factual narrative and a set of uploaded documents, build a structured fact matrix and flag issues a paralegal should check before a lawyer relies on this file.

Output STRICT JSON only — no markdown fences, no commentary before or after — matching exactly this shape:
{
  "facts": [ { "id": "f1", "claim": "short factual statement", "factType": "date|amount|name|location|event|allegation|other", "sources": [ { "sourceRef": "NARRATIVE" or "DOC1"/"DOC2"/etc, "page": null or a number if you can tell, "snippet": "short exact quote supporting this claim" } ] } ],
  "contradictions": [ { "description": "what conflicts and why", "factIds": ["f1","f4"], "severity": "high|medium|low" } ],
  "missingSupport": [ { "allegation": "an assertion in the narrative with no supporting document", "note": "what's missing" } ],
  "duplicates": [ { "description": "why these appear to be duplicates or near-duplicates", "documentIds": ["DOC1","DOC3"] } ]
}

Rules:
- Every fact's "snippet" must be an exact or near-exact quote from the source — never paraphrase into a quote.
- Only cite "sourceRef" values that actually appear in the bracketed labels below (NARRATIVE, DOC1, DOC2, ...). Never invent a document reference.
- A contradiction requires at least two facts that genuinely conflict (different dates for the same event, different amounts for the same transaction, inconsistent names for the same party, etc.) — do not flag mere phrasing differences.
- missingSupport is for allegations stated in the narrative but not corroborated by any document — leave it empty if everything is supported or if there are no documents to check against.
- duplicates is for documents that are the same underlying material (e.g. two copies of the same notice) — leave empty if none.
- If there is too little material to say anything useful, return mostly-empty arrays rather than inventing content.
- Extract at most 25 facts — prioritize the most legally significant ones (dates, amounts, parties, key allegations, section references).

[SOURCE MATERIAL]
${sourceBlocks.join("\n\n")}`;

  const raw = await completeText({ system, messages: [{ role: "user", content: "Produce the fact matrix JSON now." }], model: "primary", maxTokens: 4000 });

  let parsed: any;
  try {
    const jsonText = extractJson(raw);
    parsed = JSON.parse(jsonText);
  } catch {
    throw new EvidenceAnalysisError("The AI's response could not be parsed as valid analysis data. This can happen with unusually large or unusual documents — please try again.");
  }

  const facts: EvidenceFact[] = (Array.isArray(parsed.facts) ? parsed.facts : [])
    .filter((f: any) => f && typeof f.claim === "string" && f.claim.trim())
    .map((f: any, i: number) => ({
      id: typeof f.id === "string" ? f.id : `f${i + 1}`,
      claim: f.claim.trim(),
      factType: ["date", "amount", "name", "location", "event", "allegation", "other"].includes(f.factType) ? f.factType : "other",
      sources: (Array.isArray(f.sources) ? f.sources : []).map((s: any) => resolveSource(s, refMap)).filter((s: EvidenceFactSource | null): s is EvidenceFactSource => s !== null),
    }));

  const validFactIds = new Set(facts.map((f) => f.id));
  const contradictions: EvidenceContradiction[] = (Array.isArray(parsed.contradictions) ? parsed.contradictions : [])
    .filter((c: any) => c && typeof c.description === "string" && c.description.trim())
    .map((c: any) => ({
      description: c.description.trim(),
      factIds: (Array.isArray(c.factIds) ? c.factIds : []).filter((id: string) => validFactIds.has(id)),
      severity: ["high", "medium", "low"].includes(c.severity) ? c.severity : "medium",
    }))
    .filter((c: EvidenceContradiction) => c.factIds.length >= 2); // a "contradiction" citing fewer than 2 facts isn't one

  const missingSupport: EvidenceMissingSupport[] = (Array.isArray(parsed.missingSupport) ? parsed.missingSupport : [])
    .filter((m: any) => m && typeof m.allegation === "string" && m.allegation.trim())
    .map((m: any) => ({ allegation: m.allegation.trim(), note: typeof m.note === "string" ? m.note.trim() : "" }));

  const duplicates: EvidenceDuplicate[] = (Array.isArray(parsed.duplicates) ? parsed.duplicates : [])
    .filter((d: any) => d && typeof d.description === "string" && Array.isArray(d.documentIds))
    .map((d: any) => ({
      description: d.description.trim(),
      documentIds: d.documentIds.map((ref: string) => refMap.get(ref)?.id).filter((id: string | undefined): id is string => !!id),
    }))
    .filter((d: EvidenceDuplicate) => d.documentIds.length >= 2);

  return { facts, contradictions, missingSupport, duplicates, modelUsed: `${activeProvider()}` };
}

function resolveSource(s: any, refMap: Map<string, DocumentRecord>): EvidenceFactSource | null {
  if (!s || typeof s.sourceRef !== "string") return null;
  const snippet = typeof s.snippet === "string" ? s.snippet.trim() : "";
  if (s.sourceRef === "NARRATIVE") {
    return { type: "client_narrative", snippet };
  }
  const doc = refMap.get(s.sourceRef);
  if (!doc) return null; // the model cited a reference we never gave it — drop it rather than trust a hallucinated source
  return { type: "document", documentId: doc.id, documentName: doc.fileName, page: typeof s.page === "number" ? s.page : undefined, snippet };
}

/** Strips markdown code fences if the model wrapped its JSON in ```json ... ``` despite instructions not to. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

export class EvidenceAnalysisError extends Error {}
