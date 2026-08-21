import type { DocumentStructureNode } from "@/lib/db/documents-repo";
import { linesToStructure } from "./text-structure";
import { getOpenAiApiKey } from "@/lib/env";

export interface AudioTranscribeResult {
  text: string;
  structure: DocumentStructureNode[];
  durationSeconds?: number;
  lowConfidence: boolean;
  extractionNotes: string;
}

/**
 * Transcribes spoken content from an audio OR video file via OpenAI's Whisper
 * API (spec §6 voice-first intake, §13 audio/video evidence). Video files
 * (mp4/mpeg/webm) can be sent directly — Whisper extracts and transcribes the
 * audio track server-side, so this needs no local ffmpeg/audio-extraction
 * step, which would otherwise be a serverless-deployment liability.
 *
 * Every transcription is flagged lowConfidence: true unconditionally: speech
 * recognition on real recordings (accents, cross-talk, legal terminology,
 * background noise) is meaningfully more error-prone than OCR on a clean
 * document, so the "verify before relying on this" notice always applies —
 * never silently presented as a verbatim record.
 */
export async function transcribeAudio(buffer: Buffer, fileName: string, mimeType: string): Promise<AudioTranscribeResult> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error(
      "Audio/video transcription requires an OpenAI API key. Set OPENAI_API_KEY to enable voice intake and audio/video evidence processing."
    );
  }

  const { default: OpenAI, toFile } = await import("openai");
  const client = new OpenAI({ apiKey });
  const file = await toFile(buffer, fileName, { type: mimeType });

  const res = await client.audio.transcriptions.create({
    file,
    model: process.env.MLS_OPENAI_TRANSCRIBE_MODEL || "whisper-1",
    response_format: "verbose_json",
  });

  const text = (res.text ?? "").trim();
  const duration = "duration" in res ? (res.duration as number | undefined) : undefined;
  const segments = "segments" in res ? (res.segments as { text: string }[] | undefined) : undefined;

  if (!text) {
    throw new Error("Transcription produced no text — the recording may be silent, corrupted, or in a language/format the model could not process.");
  }

  const lines = segments?.length ? segments.map((s) => s.text.trim()).filter(Boolean) : text.split(/(?<=[.?!])\s+/);

  return {
    text,
    structure: linesToStructure(lines),
    durationSeconds: duration,
    lowConfidence: true,
    extractionNotes: "Transcribed via AI speech-to-text — please verify against the original recording, especially names, dates, figures, and section numbers.",
  };
}
