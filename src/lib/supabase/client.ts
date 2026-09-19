"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/**
 * Browser Supabase client — uses ONLY the public anon key.
 * All privileged operations are enforced by RLS + SECURITY DEFINER
 * functions in the database, never by client-side code.
 */
export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase is not configured (missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
