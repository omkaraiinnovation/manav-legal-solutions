import type { DocumentStructureNode } from "@/lib/db/documents-repo";

export interface Chunk {
  content: string;
  page?: number;
  sectionHeading?: string;
}

const TARGET_CHUNK_CHARS = 1200;
const OVERLAP_CHARS = 150;

/**
 * Structure-aware chunking for RAG: walks the parsed document's headings/
 * paragraphs so each chunk stays under one section heading where possible
 * (legal documents are heavily organized around numbered clauses/sections),
 * falling back to a plain sliding window with overlap when no structure was
 * detected (e.g. a single giant paragraph from a poorly-formatted OCR pass).
 */
export function chunkDocument(structure: DocumentStructureNode[], fallbackText: string): Chunk[] {
  if (structure.length === 0) return slidingWindowChunk(fallbackText);

  const chunks: Chunk[] = [];
  let currentHeading: string | undefined;
  let buffer = "";
  let bufferPage: number | undefined;

  const flush = () => {
    if (buffer.trim().length > 0) {
      chunks.push({ content: buffer.trim(), page: bufferPage, sectionHeading: currentHeading });
    }
    buffer = "";
  };

  for (const node of structure) {
    if (node.type === "heading") {
      flush();
      currentHeading = node.text;
      bufferPage = node.page;
      buffer = `${node.text}\n`;
      continue;
    }
    if (buffer.length + node.text.length > TARGET_CHUNK_CHARS) {
      flush();
      bufferPage = node.page;
      buffer = currentHeading ? `${currentHeading}\n` : "";
    }
    if (!bufferPage) bufferPage = node.page;
    buffer += (buffer ? " " : "") + node.text;
  }
  flush();

  return chunks.length ? chunks : slidingWindowChunk(fallbackText);
}

function slidingWindowChunk(text: string): Chunk[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks: Chunk[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + TARGET_CHUNK_CHARS, clean.length);
    chunks.push({ content: clean.slice(start, end) });
    if (end >= clean.length) break;
    start = end - OVERLAP_CHARS;
  }
  return chunks;
}
