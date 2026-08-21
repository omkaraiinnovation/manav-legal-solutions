import type { DocumentStructureNode } from "@/lib/db/documents-repo";
import { parsePdf } from "./parse-pdf";
import { parseDocx } from "./parse-docx";
import { parseImage } from "./parse-image";
import { transcribeAudio } from "./transcribe-audio";
import type { SourceKind } from "./mime";

export interface IngestResult {
  text: string;
  structure: DocumentStructureNode[];
  pageCount?: number;
  durationSeconds?: number;
  ocrUsed: boolean;
  lowConfidence: boolean;
  extractionNotes?: string;
}

export class DocumentParseError extends Error {}

/**
 * The single dispatch point for the universal ingestion pipeline (spec §8:
 * "one common processing architecture" rather than a disconnected upload
 * mechanism per feature). Every module that accepts a document — matter
 * workspace, consultation intake, drafting, etc. — routes through this same
 * function via the shared parse API route, so a new source_kind only needs
 * to be taught here once.
 */
export async function ingestFile(buffer: Buffer, fileName: string, fileType: string, sourceKind: SourceKind): Promise<IngestResult> {
  switch (sourceKind) {
    case "document":
      return ingestDocument(buffer, fileType);
    case "image":
      return ingestImage(buffer, fileType);
    case "audio":
    case "video":
      return ingestAudioOrVideo(buffer, fileName, fileType);
  }
}

async function ingestDocument(buffer: Buffer, fileType: string): Promise<IngestResult> {
  if (fileType === "application/pdf") {
    let result;
    try {
      result = await parsePdf(buffer);
    } catch (err) {
      throw new DocumentParseError(
        `Could not read this PDF (${err instanceof Error ? err.message : "unknown error"}). It may be corrupt, password-protected, or use an unsupported PDF feature.`
      );
    }
    if (!result.text.trim()) {
      throw new DocumentParseError(
        result.ocrUsed ? "OCR ran but produced no readable text — the scan quality may be too low, or the pages may be blank." : "No text could be extracted from this PDF."
      );
    }
    return { text: result.text, structure: result.structure, pageCount: result.pageCount, ocrUsed: result.ocrUsed, lowConfidence: false };
  }

  if (fileType === "application/msword") {
    throw new DocumentParseError("Legacy .doc files are not supported for automatic parsing — please save the document as .docx and re-upload.");
  }
  if (fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const result = await parseDocx(buffer);
    if (!result.text.trim()) throw new DocumentParseError("No text could be extracted from this Word document — it may be empty or use unsupported content.");
    return { text: result.text, structure: result.structure, ocrUsed: false, lowConfidence: false };
  }

  throw new DocumentParseError(`Parsing is not implemented for file type "${fileType}".`);
}

async function ingestImage(buffer: Buffer, fileType: string): Promise<IngestResult> {
  let result;
  try {
    result = await parseImage(buffer, fileType);
  } catch (err) {
    throw new DocumentParseError(`Could not read this image (${err instanceof Error ? err.message : "unknown error"}).`);
  }
  if (!result.text.trim()) {
    throw new DocumentParseError("OCR ran but produced no readable text — the image may be blank, too low-resolution, or contain no legible text.");
  }
  return { text: result.text, structure: result.structure, ocrUsed: true, lowConfidence: result.lowConfidence, extractionNotes: result.extractionNotes };
}

async function ingestAudioOrVideo(buffer: Buffer, fileName: string, fileType: string): Promise<IngestResult> {
  let result;
  try {
    result = await transcribeAudio(buffer, fileName, fileType);
  } catch (err) {
    throw new DocumentParseError(err instanceof Error ? err.message : "Transcription failed for an unknown reason.");
  }
  return {
    text: result.text,
    structure: result.structure,
    durationSeconds: result.durationSeconds,
    ocrUsed: false,
    lowConfidence: result.lowConfidence,
    extractionNotes: result.extractionNotes,
  };
}
