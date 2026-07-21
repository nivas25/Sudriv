import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest } from "next/server";

/**
 * Next.js Middleware — Auth Guard
 *
 * Runs on every request to check authentication state via Supabase.
 * Unauthenticated users are redirected to /login.
 * Authenticated users are redirected away from /login.
 *
 * See: knowledge-base/08-backend-and-realtime.md
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|logo.png).*)",
  ],
};
