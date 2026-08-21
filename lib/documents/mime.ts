/**
 * Central format registry for the universal ingestion pipeline (spec §3/§8).
 * Everything that decides "is this file type supported, and what kind of
 * document does it become" reads from here, so upload validation, ZIP
 * expansion, and parse-route dispatch can't drift out of sync with each
 * other as new formats are added.
 */
export type SourceKind = "document" | "image" | "audio" | "video";

interface FormatEntry {
  mimeType: string;
  sourceKind: SourceKind;
  extensions: string[];
}

const FORMATS: FormatEntry[] = [
  { mimeType: "application/pdf", sourceKind: "document", extensions: [".pdf"] },
  { mimeType: "application/msword", sourceKind: "document", extensions: [".doc"] },
  { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sourceKind: "document", extensions: [".docx"] },
  { mimeType: "image/png", sourceKind: "image", extensions: [".png"] },
  { mimeType: "image/jpeg", sourceKind: "image", extensions: [".jpg", ".jpeg"] },
  { mimeType: "image/webp", sourceKind: "image", extensions: [".webp"] },
  { mimeType: "audio/mpeg", sourceKind: "audio", extensions: [".mp3", ".mpga"] },
  { mimeType: "audio/wav", sourceKind: "audio", extensions: [".wav"] },
  { mimeType: "audio/x-m4a", sourceKind: "audio", extensions: [".m4a"] },
  { mimeType: "audio/ogg", sourceKind: "audio", extensions: [".ogg"] },
  { mimeType: "audio/flac", sourceKind: "audio", extensions: [".flac"] },
  { mimeType: "audio/webm", sourceKind: "audio", extensions: [".weba"] },
  { mimeType: "video/mp4", sourceKind: "video", extensions: [".mp4"] },
  { mimeType: "video/mpeg", sourceKind: "video", extensions: [".mpeg", ".mpg"] },
  { mimeType: "video/webm", sourceKind: "video", extensions: [".webm"] },
];

const BY_EXTENSION = new Map<string, FormatEntry>(FORMATS.flatMap((f) => f.extensions.map((ext) => [ext, f] as const)));
const BY_MIME = new Map<string, FormatEntry>(FORMATS.map((f) => [f.mimeType, f]));

// Browsers/OSes are inconsistent about the MIME type they report for audio/
// video, and some (e.g. old Safari, some Android recorders) send nothing at
// all — these aliases fold the common variants back onto our canonical entry.
const MIME_ALIASES: Record<string, string> = {
  "audio/mp4": "audio/x-m4a",
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/mp3": "audio/mpeg",
  "video/quicktime": "video/mp4", // .mov — OpenAI's endpoint does not list it, but many are mp4-container in practice; caught downstream if not.
};

function normalizeMime(mimeType: string): string {
  // Strip codec parameters (e.g. "audio/webm;codecs=opus" from MediaRecorder) before matching.
  const bare = mimeType.split(";")[0].trim();
  return MIME_ALIASES[bare] ?? bare;
}

export function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx).toLowerCase();
}

/** Resolves a format entry from whichever signal is more trustworthy — the browser's
 *  reported MIME type first, falling back to the file extension when that's missing/generic. */
export function resolveFormat(fileName: string, mimeType: string): FormatEntry | undefined {
  const normalized = normalizeMime(mimeType);
  if (normalized && normalized !== "application/octet-stream" && BY_MIME.has(normalized)) return BY_MIME.get(normalized);
  return BY_EXTENSION.get(extensionOf(fileName));
}

export function isSupportedExtension(ext: string): boolean {
  return BY_EXTENSION.has(ext.toLowerCase());
}

export function isZip(fileName: string, mimeType: string): boolean {
  return extensionOf(fileName) === ".zip" || mimeType === "application/zip" || mimeType === "application/x-zip-compressed";
}

export function extensionMimeType(ext: string): string {
  return BY_EXTENSION.get(ext.toLowerCase())?.mimeType ?? "application/octet-stream";
}

export function sourceKindFor(fileName: string, mimeType: string): SourceKind | undefined {
  return resolveFormat(fileName, mimeType)?.sourceKind;
}

export const ACCEPT_ATTRIBUTE = [
  ...FORMATS.flatMap((f) => f.extensions),
  ".zip",
].join(",");

export const HUMAN_SUPPORTED_SUMMARY =
  "PDF, DOCX, DOC · JPG, PNG, WEBP (incl. handwriting) · MP3, WAV, M4A, OGG, FLAC · MP4, MPEG, WEBM · ZIP (batches)";
