import type { DocumentStructureNode } from "@/lib/db/documents-repo";

/**
 * Shared across every parser (PDF, image OCR, audio/video transcription):
 * promotes a plain text line to "heading" when it's short, unpunctuated, and
 * either ALL CAPS or has a numbered/lettered lead-in ("1.", "Section 3",
 * "(a)") — good enough for legal documents' fairly regular formatting
 * without needing a layout-analysis model.
 */
export function classifyLine(line: string): DocumentStructureNode["type"] {
  const trimmed = line.trim();
  if (!trimmed) return "paragraph";
  const isShort = trimmed.length < 90;
  const endsWithoutPunctuation = !/[.,;:]$/.test(trimmed);
  const looksNumbered = /^(\d+[.)]|\(?[a-zA-Z]\)|section\s+\d+|chapter\s+\d+|schedule|annexure)/i.test(trimmed);
  const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
  if (isShort && endsWithoutPunctuation && (looksNumbered || isAllCaps)) return "heading";
  return "paragraph";
}

/** Splits raw lines into structure nodes, dropping blanks. `page` is attached uniformly when given (PDF pages); omitted for sources with no page concept (images, audio). */
export function linesToStructure(lines: string[], page?: number): DocumentStructureNode[] {
  return lines
    .map((l) => l.trim())
    .filter(Boolean)
    .map((text) => ({ type: classifyLine(text), text, page }));
}
