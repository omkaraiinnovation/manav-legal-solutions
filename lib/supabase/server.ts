import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

/**
 * Server-side Supabase client bound to the current request's auth cookies.
 * Every query made with this client runs AS the signed-in user — Postgres
 * Row-Level Security (see supabase/migrations) is what enforces tenant and
 * matter isolation, not application code. There is deliberately no
 * service-role client anywhere in this app.
 *
 * Deliberately untyped (no <Database> generic): the hand-maintained
 * database.types.ts (see that file) is kept as living documentation of the
 * schema, but wiring it as the strict generic here caused supabase-js's
 * query-builder inference to collapse to `never` on some chained
 * .select().eq().single() calls in this SDK version — a dev-time typing
 * issue only, with no runtime effect either way.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Parameters<typeof cookieStore.set>[2] }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options as any));
        } catch {
          // Called from a Server Component render — middleware refreshes the session instead.
        }
      },
    },
  });
}
