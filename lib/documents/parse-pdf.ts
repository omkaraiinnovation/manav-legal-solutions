import type { DocumentStructureNode } from "@/lib/db/documents-repo";
import { linesToStructure } from "./text-structure";

export interface PdfParseResult {
  text: string;
  structure: DocumentStructureNode[];
  pageCount: number;
  ocrUsed: boolean;
  ocrPagesProcessed?: number;
  ocrTruncated?: boolean;
}

const MIN_CHARS_PER_PAGE_FOR_TEXT_LAYER = 20; // below this average, treat the PDF as scanned/image-only
const MAX_OCR_PAGES = 15; // time-bounded — see module doc below

function buildStructure(pages: string[]): DocumentStructureNode[] {
  return pages.flatMap((pageText, idx) => linesToStructure(pageText.split(/\r?\n/), idx + 1));
}

/**
 * Extracts text from a PDF buffer.
 *
 * Flow: pdf-parse for the embedded text layer (fast, no rendering) → if the
 * average characters/page is below MIN_CHARS_PER_PAGE_FOR_TEXT_LAYER, the PDF
 * is treated as scanned/image-only and we fall back to rendering each page
 * (via pdfjs-dist + @napi-rs/canvas, capped at MAX_OCR_PAGES for serverless
 * time limits) and running Tesseract OCR on the rendered image.
 */
export async function parsePdf(buffer: Buffer): Promise<PdfParseResult> {
  const pdfParseModule = (await import("pdf-parse")).default;
  const pageTexts: string[] = [];
  const parsed = await pdfParseModule(buffer, {
    pagerender: async (pageData: any) => {
      const content = await pageData.getTextContent();
      const text = content.items.map((it: any) => it.str).join(" ");
      pageTexts.push(text);
      return text;
    },
  });

  const pageCount = parsed.numpages || pageTexts.length || 1;
  const avgCharsPerPage = parsed.text.length / Math.max(pageCount, 1);

  if (avgCharsPerPage >= MIN_CHARS_PER_PAGE_FOR_TEXT_LAYER) {
    return {
      text: parsed.text,
      structure: buildStructure(pageTexts.length ? pageTexts : [parsed.text]),
      pageCount,
      ocrUsed: false,
    };
  }

  // Scanned / image-only PDF — OCR fallback.
  return runOcrFallback(buffer, pageCount);
}

async function runOcrFallback(buffer: Buffer, pageCount: number): Promise<PdfParseResult> {
  const { createCanvas } = await import("@napi-rs/canvas");
  // pdfjs-dist's legacy Node build avoids requiring DOMMatrix/Path2D browser globals.
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createWorker } = await import("tesseract.js");

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const pagesToProcess = Math.min(pdf.numPages, MAX_OCR_PAGES);
  const truncated = pdf.numPages > MAX_OCR_PAGES;

  const worker = await createWorker("eng");
  const pageTexts: string[] = [];
  try {
    for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx as any, viewport } as any).promise;
      const pngBuffer = canvas.toBuffer("image/png");
      const { data } = await worker.recognize(pngBuffer);
      pageTexts.push(data.text);
    }
  } finally {
    await worker.terminate();
  }

  return {
    text: pageTexts.join("\n\n"),
    structure: buildStructure(pageTexts),
    pageCount,
    ocrUsed: true,
    ocrPagesProcessed: pagesToProcess,
    ocrTruncated: truncated,
  };
}
