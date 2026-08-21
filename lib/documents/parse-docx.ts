import mammoth from "mammoth";
import type { DocumentStructureNode } from "@/lib/db/documents-repo";

export interface ParseResult {
  text: string;
  structure: DocumentStructureNode[];
  pageCount?: number;
}

/** Extracts text + heading/paragraph structure from a .docx buffer via mammoth's HTML conversion,
 *  which is the only mammoth mode that preserves heading levels — plain extractRawText discards them. */
export async function parseDocx(buffer: Buffer): Promise<ParseResult> {
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const structure: DocumentStructureNode[] = [];
  const textParts: string[] = [];

  // Lightweight HTML walk — no DOM available in the Node runtime, so this parses
  // mammoth's known, constrained output tag set directly rather than pulling in jsdom.
  const blockPattern = /<(h[1-6]|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockPattern.exec(html)) !== null) {
    const [, tag, inner] = match;
    const text = inner.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    if (!text) continue;
    if (/^h[1-6]$/.test(tag)) {
      structure.push({ type: "heading", level: Number(tag[1]), text });
    } else if (tag === "li") {
      structure.push({ type: "list_item", text });
    } else {
      structure.push({ type: "paragraph", text });
    }
    textParts.push(text);
  }

  return { text: textParts.join("\n\n"), structure };
}
