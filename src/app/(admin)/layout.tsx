import { isSupabaseConfigured } from "@/lib/env";
import { requireAdmin } from "@/lib/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { NotConfigured } from "@/components/ui/not-configured";

export const dynamic = "force-dynamic";

/**
 * Every page under this layout is server-side protected (spec §6):
 *  - no valid Supabase auth session      → redirect /login (also middleware)
 *  - session without active admin profile → sign out + redirect
 * Permissions per section are checked inside each page AND in the database.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) return <NotConfigured />;

  const { admin } = await requireAdmin();

  return <AppShell admin={admin}>{children}</AppShell>;
}
