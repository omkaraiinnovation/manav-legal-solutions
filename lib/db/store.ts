/**
 * Local file-backed data store.
 *
 * MLS_DATA_MODE=local (default) persists every collection as a JSON file.
 * The shape of every collection matches the Supabase schema 1:1 (see
 * /supabase/migrations), so swapping this module for a real Postgres client
 * later is a data-layer change only — no call-site changes.
 *
 * Where the live copy lives depends on the runtime:
 *  - Normal server (local dev, a long-lived container) → /data/store next to
 *    the project, so writes genuinely persist across requests.
 *  - Vercel serverless (VERCEL=1) → the project directory is read-only
 *    outside /tmp, and /tmp itself is wiped on every cold start / new
 *    instance. Writes there succeed and are visible for the life of that
 *    instance, but are NOT durable — this is expected for a demo deployment,
 *    not a bug. For real persistent multi-user data, provision Supabase and
 *    set MLS_DATA_MODE=supabase (see .env.example / README).
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const SEED_DIR = path.join(process.cwd(), "data", "seed");
const STORE_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), "mls-data-store")
  : path.join(process.cwd(), "data", "store");

function ensureDir() {
  if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
}

function storePath(collection: string) {
  return path.join(STORE_DIR, `${collection}.json`);
}

function seedPath(collection: string) {
  return path.join(SEED_DIR, `${collection}.json`);
}

/** Reads a collection, initializing it from /data/seed on first access. */
export function readCollection<T>(collection: string): T[] {
  try {
    ensureDir();
    const live = storePath(collection);
    if (fs.existsSync(live)) {
      const raw = fs.readFileSync(live, "utf-8");
      return raw.trim() ? (JSON.parse(raw) as T[]) : [];
    }
    const seed = seedPath(collection);
    if (fs.existsSync(seed)) {
      const raw = fs.readFileSync(seed, "utf-8");
      const data = raw.trim() ? (JSON.parse(raw) as T[]) : [];
      try {
        fs.writeFileSync(live, JSON.stringify(data, null, 2), "utf-8");
      } catch {
        // Read-only environment — fine, we still return the seed data below.
      }
      return data;
    }
    return [];
  } catch {
    // Store directory unwritable/unreadable — fall back to seed content directly.
    const seed = seedPath(collection);
    if (fs.existsSync(seed)) {
      const raw = fs.readFileSync(seed, "utf-8");
      return raw.trim() ? (JSON.parse(raw) as T[]) : [];
    }
    return [];
  }
}

export function writeCollection<T>(collection: string, data: T[]): void {
  try {
    ensureDir();
    fs.writeFileSync(storePath(collection), JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // Non-durable / read-only environment: the write silently no-ops rather
    // than 500ing the request. See the module doc comment above.
  }
}

export function insert<T extends { id: string }>(collection: string, record: T): T {
  const all = readCollection<T>(collection);
  all.push(record);
  writeCollection(collection, all);
  return record;
}

export function upsert<T extends { id: string }>(collection: string, record: T): T {
  const all = readCollection<T>(collection);
  const idx = all.findIndex((r) => r.id === record.id);
  if (idx >= 0) all[idx] = record;
  else all.push(record);
  writeCollection(collection, all);
  return record;
}

export function update<T extends { id: string }>(
  collection: string,
  id: string,
  patch: Partial<T>
): T | undefined {
  const all = readCollection<T>(collection);
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) return undefined;
  all[idx] = { ...all[idx], ...patch };
  writeCollection(collection, all);
  return all[idx];
}

export function remove(collection: string, id: string): void {
  const all = readCollection<{ id: string }>(collection);
  writeCollection(collection, all.filter((r) => r.id !== id));
}

export function findById<T extends { id: string }>(collection: string, id: string): T | undefined {
  return readCollection<T>(collection).find((r) => r.id === id);
}

/** Resets a collection's live copy back to its seed (used by the Admin > Reset Demo Data action). */
export function resetToSeed(collection: string): void {
  try {
    ensureDir();
    const seed = seedPath(collection);
    if (fs.existsSync(seed)) {
      fs.copyFileSync(seed, storePath(collection));
    } else {
      writeCollection(collection, []);
    }
  } catch {
    // Read-only environment — readCollection() already falls back to seed content.
  }
}

export const COLLECTIONS = {
  tenants: "tenants",
  users: "users",
  acts: "acts",
  provisions: "provisions",
  caseLaw: "case_law",
  legalRelationships: "legal_relationships",
  documentTypes: "document_types",
  matters: "matters",
  matterParties: "matter_parties",
  drafts: "drafts",
  draftCitations: "draft_citations",
  reviewActions: "review_actions",
  chronologyEvents: "chronology_events",
  deadlines: "deadlines",
  evidenceItems: "evidence_items",
  auditLogs: "audit_logs",
  chatMessages: "chat_messages",
  stateOnboarding: "state_onboarding",
} as const;
