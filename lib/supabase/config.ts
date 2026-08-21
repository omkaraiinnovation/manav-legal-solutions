/**
 * Supabase project connection info.
 *
 * The URL and anon/publishable key are NOT secret — they're designed to be
 * shipped to the browser and are safe to read from source when the env var
 * isn't set yet (e.g. before OPENAI_API_KEY-style dashboard configuration is
 * done). Row-Level Security, not key secrecy, is what protects tenant data.
 * Never put the service-role key here — this project intentionally never
 * uses one; every query runs as the authenticated user via RLS.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://tqnrbgdtacflcyyisgjm.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxbnJiZ2R0YWNmbGN5eWlzZ2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyODczNDcsImV4cCI6MjEwMjg2MzM0N30.k-fleqfNJ84uSwJQXFr-HEKMFDlzSBKhlYBfCVMKEFc";

export const DEFAULT_TENANT_ID = "11111111-1111-1111-1111-111111111111";
export const MATTER_DOCUMENTS_BUCKET = "matter-documents";
