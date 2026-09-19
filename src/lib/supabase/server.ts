import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Cookie-bound server client (renders + server actions + route handlers).
 * Runs with the logged-in admin's JWT, so RLS and admin_can() apply —
 * no elevated privileges here by design.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl || "https://placeholder.supabase.co", supabaseAnonKey || "placeholder", {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — safe to ignore; middleware
          // refreshes sessions on every request.
        }
      },
    },
  });
}
