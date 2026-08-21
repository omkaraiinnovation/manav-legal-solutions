/**
 * Build-time helper, Vercel-only.
 *
 * Two seed collections (provisions.json, acts.json) are large enough that
 * they're fetched from the GitHub repo at build time rather than always
 * shipped inline in every deploy payload. In local dev these files already
 * exist on disk (checked into git) and this script is a no-op. On a fresh
 * Vercel deploy that omits them, this step fetches the exact same content
 * from the public GitHub repo before `next build` runs, so the rest of the
 * app (lib/db/store.ts and everywhere it's read) never has to know the
 * difference — same files, same path, same synchronous fs API.
 */
import fs from "node:fs";
import path from "node:path";

const REPO_RAW_BASE = "https://raw.githubusercontent.com/omkaraiinnovation/manav-legal-solutions/main/data/seed";
const SEED_DIR = path.join(process.cwd(), "data", "seed");
const LARGE_COLLECTIONS = ["provisions.json", "acts.json"];

async function ensureSeedFile(name) {
  const localPath = path.join(SEED_DIR, name);
  if (fs.existsSync(localPath) && fs.statSync(localPath).size > 100) {
    console.log(`[fetch-large-seed] ${name} already present locally (${fs.statSync(localPath).size} bytes) — skipping fetch.`);
    return;
  }
  const url = `${REPO_RAW_BASE}/${name}`;
  console.log(`[fetch-large-seed] fetching ${url} ...`);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    JSON.parse(text); // validate before writing
    fs.mkdirSync(SEED_DIR, { recursive: true });
    fs.writeFileSync(localPath, text, "utf-8");
    console.log(`[fetch-large-seed] wrote ${name} (${text.length} bytes).`);
  } catch (err) {
    console.warn(`[fetch-large-seed] WARNING: could not fetch ${name} (${err.message}). Writing an empty array so the build doesn't fail — the Knowledge Base will show reduced coverage until this is resolved.`);
    fs.mkdirSync(SEED_DIR, { recursive: true });
    fs.writeFileSync(localPath, "[]", "utf-8");
  }
}

for (const name of LARGE_COLLECTIONS) {
  await ensureSeedFile(name);
}
