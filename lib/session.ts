/**
 * Demo session layer. There is no real auth provider wired up in this local
 * build (see .env.example / MLS_DATA_MODE) — a cookie holds the "logged in"
 * user id and the UI exposes a role switcher so every persona (platform
 * admin, firm admin, advocate, paralegal, client) can be exercised without
 * standing up Supabase Auth. Swapping in real auth means replacing this file
 * only — every route already reads "current user" through here.
 */
import { cookies } from "next/headers";
import { Users, Tenants } from "@/lib/db/repo";
import type { User } from "@/lib/types";

const COOKIE_NAME = "mls_demo_user";
const DEFAULT_USER_ID = "user-advocate-1";

export async function getCurrentUser(): Promise<User> {
  const jar = await cookies();
  const id = jar.get(COOKIE_NAME)?.value || DEFAULT_USER_ID;
  return Users.get(id) ?? Users.get(DEFAULT_USER_ID)!;
}

export async function getCurrentTenant() {
  const user = await getCurrentUser();
  return Tenants.get(user.tenantId)!;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
