import type { DocumentStructureNode } from "@/lib/db/documents-repo";
import { linesToStructure } from "./text-structure";

export interface ImageParseResult {
  text: string;
  structure: DocumentStructureNode[];
  lowConfidence: boolean;
  extractionNotes?: string;
  method: "tesseract" | "vision-llm";
}

const MIN_CHARS_FOR_CONFIDENT_TESSERACT = 15;
const MIN_TESSERACT_CONFIDENCE = 60; // Tesseract's own 0-100 mean-confidence score

/**
 * OCR for a standalone image upload (JPG/PNG — scanned pages, photographed
 * documents, handwritten notes; spec §4). Tesseract runs first: fast, free,
 * good on printed text. When its own confidence score is low or it produced
 * almost nothing — the common signature of handwriting, which Tesseract
 * handles poorly — this escalates to a vision-capable LLM instead of
 * presenting Tesseract's unreliable guess as fact. Every vision-LLM
 * transcription is still flagged lowConfidence: true for human verification,
 * per the "No False Completeness" rule — a multimodal model reading
 * handwriting is meaningfully better than Tesseract, not infallible.
 */
export async function parseImage(buffer: Buffer, mimeType: string): Promise<ImageParseResult> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  let tesseractText = "";
  let confidence = 0;
  try {
    const { data } = await worker.recognize(buffer);
    tesseractText = data.text ?? "";
    confidence = data.confidence ?? 0;
  } finally {
    await worker.terminate();
  }

  const tesseractLooksReliable = tesseractText.trim().length >= MIN_CHARS_FOR_CONFIDENT_TESSERACT && confidence >= MIN_TESSERACT_CONFIDENCE;
  if (tesseractLooksReliable) {
    return { text: tesseractText, structure: linesToStructure(tesseractText.split(/\r?\n/)), lowConfidence: false, method: "tesseract" };
  }

  const visionResult = await visionOcrFallback(buffer, mimeType);
  if (visionResult) return visionResult;

  // No OPENAI_API_KEY configured to run the fallback — return what Tesseract got,
  // clearly flagged rather than silently trusted.
  return {
    text: tesseractText,
    structure: linesToStructure(tesseractText.split(/\r?\n/)),
    lowConfidence: true,
    extractionNotes: `OCR confidence was low (${confidence.toFixed(0)}%), consistent with handwriting or a poor-quality scan, and no vision-model fallback is configured (set OPENAI_API_KEY). This text may contain significant errors — verify against the original image before relying on it.`,
    method: "tesseract",
  };
}

async function visionOcrFallback(buffer: Buffer, mimeType: string): Promise<ImageParseResult | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await client.chat.completions.create({
    model: process.env.MLS_OPENAI_VISION_MODEL || "gpt-4o-mini",
    max_tokens: 2000,
    messages: [
      {
        role: "system",
        content:
          "You transcribe legal documents from images, including handwriting, as accurately as possible. Output ONLY the transcribed text, preserving line breaks, numbering, and paragraph structure. If a word or passage is illegible, write [ILLEGIBLE] in its place rather than guessing at it. Do not add commentary, summaries, or translations.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Transcribe this document image exactly as written." },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${buffer.toString("base64")}` } },
        ],
      },
    ],
  });

  const text = res.choices[0]?.message?.content?.trim() ?? "";
  if (!text) return null;

  const hasIllegiblePassages = /\[ILLEGIBLE\]/i.test(text);
  return {
    text,
    structure: linesToStructure(text.split(/\r?\n/)),
    lowConfidence: true,
    extractionNotes: hasIllegiblePassages
      ? "Transcribed via AI vision model (handwriting or low-quality scan) — one or more passages were illegible and marked [ILLEGIBLE]. Verify against the original image."
      : "Transcribed via AI vision model (handwriting or low-quality scan) — please verify against the original image before relying on this text.",
    method: "vision-llm",
  };
}
