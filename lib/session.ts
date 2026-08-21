import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { User, Tenant } from "@/lib/types";

/** The authenticated user's app-level profile (public.users row), joined to their auth identity.
 *  Throws via redirect("/login") if there is no session — middleware normally catches this first,
 *  this is the defense-in-depth check for Server Components/Route Handlers called directly. */
export async function getCurrentUser(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  const { data: profile, error } = await supabase.from("users").select("*").eq("id", authUser.id).single();

  if (error || !profile) {
    // Row hasn't been created by the on_auth_user_created trigger yet (rare race on first sign-in).
    redirect("/login");
  }

  return {
    id: profile.id,
    tenantId: profile.tenant_id ?? "",
    fullName: profile.full_name ?? authUser.email ?? "User",
    role: (profile.role as User["role"]) ?? "client",
    languagePref: (profile.language_pref as User["languagePref"]) ?? "en",
    email: profile.email ?? authUser.email ?? undefined,
    createdAt: profile.created_at ?? new Date().toISOString(),
  };
}

/** Same as getCurrentUser but returns null instead of redirecting — for routes that render
 *  differently when signed out (e.g. the login page itself). */
export async function getCurrentUserOrNull(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;
  const { data: profile } = await supabase.from("users").select("*").eq("id", authUser.id).single();
  if (!profile) return null;
  return {
    id: profile.id,
    tenantId: profile.tenant_id ?? "",
    fullName: profile.full_name ?? authUser.email ?? "User",
    role: (profile.role as User["role"]) ?? "client",
    languagePref: (profile.language_pref as User["languagePref"]) ?? "en",
    email: profile.email ?? authUser.email ?? undefined,
    createdAt: profile.created_at ?? new Date().toISOString(),
  };
}

export async function getCurrentTenant(): Promise<Tenant> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase.from("tenants").select("*").eq("id", user.tenantId).single();
  return {
    id: data?.id ?? user.tenantId,
    name: data?.name ?? "Manav Legal Solutions",
    slug: data?.slug ?? "manav-legal-solutions",
    branding: (data?.branding as Tenant["branding"]) ?? {},
    stateAnchor: (data?.state_anchor as Tenant["stateAnchor"]) ?? undefined,
    createdAt: data?.created_at ?? new Date().toISOString(),
  };
}
