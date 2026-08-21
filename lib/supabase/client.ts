"use client";
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

/** Browser-side Supabase client — used by client components (login form, file upload, chat).
 *  See lib/supabase/server.ts for why this is deliberately untyped. */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
