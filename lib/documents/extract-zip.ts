import AdmZip from "adm-zip";
import { extensionMimeType, isSupportedExtension } from "./mime";

export interface ZipEntryFile {
  fileName: string;
  buffer: Buffer;
  mimeType: string;
}

export interface ZipExtractResult {
  files: ZipEntryFile[];
  skipped: { fileName: string; reason: string }[];
}

const MAX_ENTRIES = 50;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 150 * 1024 * 1024; // 150MB combined — guards against zip-bomb-style archives

/**
 * Expands an uploaded .zip into its individual documents (spec §3 batch
 * upload / §8 universal ingestion). Each supported member becomes its own
 * document, tagged with the archive it came from; unsupported members
 * (nested archives, executables, unrecognized types) and anything past the
 * safety caps are reported back as skipped rather than silently dropped, so
 * the uploader can see exactly what was and wasn't processed.
 */
export function extractZip(buffer: Buffer): ZipExtractResult {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  const files: ZipEntryFile[] = [];
  const skipped: { fileName: string; reason: string }[] = [];
  let totalBytes = 0;

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const baseName = entry.entryName.split("/").pop() ?? entry.entryName;
    if (baseName.startsWith(".") || baseName.startsWith("__MACOSX")) continue; // OS metadata noise, not real content

    if (files.length >= MAX_ENTRIES) {
      skipped.push({ fileName: entry.entryName, reason: `Archive has more than ${MAX_ENTRIES} files — remaining entries were not processed.` });
      continue;
    }

    const ext = baseName.includes(".") ? baseName.slice(baseName.lastIndexOf(".")).toLowerCase() : "";
    if (ext === ".zip") {
      skipped.push({ fileName: entry.entryName, reason: "Nested .zip archives are not expanded automatically — please extract and re-upload its contents." });
      continue;
    }
    if (!isSupportedExtension(ext)) {
      skipped.push({ fileName: entry.entryName, reason: `Unsupported file type "${ext || "unknown"}".` });
      continue;
    }

    const data = entry.getData();
    totalBytes += data.length;
    if (totalBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      skipped.push({ fileName: entry.entryName, reason: "Archive's total uncompressed size exceeds the 150MB batch limit." });
      continue;
    }
    if (data.length === 0) {
      skipped.push({ fileName: entry.entryName, reason: "File is empty (0 bytes)." });
      continue;
    }

    files.push({ fileName: baseName, buffer: data, mimeType: extensionMimeType(ext) });
  }

  return { files, skipped };
}
