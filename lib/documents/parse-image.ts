import type { DocumentStructureNode } from "@/lib/db/documents-repo";
import { linesToStructure } from "./text-structure";

export interface ImageParseResult {
  text: string;
  structure: DocumentStructureNode[];
  lowConfidence: boolean;
  extractionNotes?: string;
}

/**
 * OCR for a standalone image upload (JPG/PNG/WEBP — scanned pages,
 * photographed documents, handwritten notes; spec §4). Transcription runs
 * through a vision-capable LLM rather than Tesseract: Tesseract.js's Node
 * worker requires a relative `require('..')` from its worker-script that
 * Vercel's serverless file-tracing does not resolve (confirmed in
 * production — every call hung to the function's timeout), and even where
 * it does run, its handwriting accuracy is poor enough that this app's own
 * "No False Completeness" standard wouldn't want it trusted anyway. A
 * multimodal LLM handles both printed and handwritten material in one path,
 * with no native WASM worker to fail inside a serverless bundle.
 *
 * Every result is flagged lowConfidence: true — vision-model transcription
 * is meaningfully better than the alternative, not infallible, so it always
 * carries the "verify before relying on this" notice.
 */
export async function parseImage(buffer: Buffer, mimeType: string): Promise<ImageParseResult> {
  const text = await visionTranscribe(buffer, mimeType);
  if (!text) {
    throw new Error("OCR ran but produced no readable text — the image may be blank, too low-resolution, or contain no legible text.");
  }
  const hasIllegiblePassages = /\[ILLEGIBLE\]/i.test(text);
  return {
    text,
    structure: linesToStructure(text.split(/\r?\n/)),
    lowConfidence: true,
    extractionNotes: hasIllegiblePassages
      ? "Transcribed via AI vision model — one or more passages were illegible and marked [ILLEGIBLE]. Verify against the original image."
      : "Transcribed via AI vision model — please verify against the original image before relying on this text.",
  };
}

/** The raw vision-model OCR call, exported so parse-pdf.ts's scanned-page fallback can reuse it
 *  per rendered page instead of duplicating the OpenAI call. */
export async function visionTranscribe(buffer: Buffer, mimeType: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OCR requires an OpenAI API key. Set OPENAI_API_KEY to enable OCR for images, scanned pages, and handwriting.");
  }
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let res;
  try {
    res = await client.chat.completions.create({
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
  } catch (err: any) {
    // Diagnostic only — "Connection error." from the OpenAI SDK is a generic
    // wrapper; the real cause (DNS, TLS, timeout, or something the SDK
    // rejected client-side) lives in .cause. Logging it (never the request
    // content or the API key) is how we find out which.
    console.error(
      "[parse-image] OpenAI vision call failed.",
      JSON.stringify({ name: err?.name, message: err?.message, status: err?.status, causeMessage: err?.cause?.message, causeCode: err?.cause?.code })
    );
    throw err;
  }
  return res.choices[0]?.message?.content?.trim() ?? "";
}
