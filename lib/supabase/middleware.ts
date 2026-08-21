import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

/** Refreshes the Supabase auth session on every request and redirects signed-out
 *  users away from protected routes. Called from the root middleware.ts. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Parameters<typeof response.cookies.set>[2] }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options as any));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicRoute = ["/login", "/signup"].some((p) => request.nextUrl.pathname.startsWith(p));
  const isStaticAsset = request.nextUrl.pathname.startsWith("/_next") || request.nextUrl.pathname.startsWith("/api/auth");

  if (!user && !isPublicRoute && !isStaticAsset) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (user && isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
