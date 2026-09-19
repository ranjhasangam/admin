-- ============================================================================
--  SD DIGITAL HUB — ADMIN PANEL ROLLBACK (99)  [OPTIONAL — use with care]
-- ============================================================================
--  Removes ONLY the structures added by 01_admin_migration.sql.
--  NEVER touches: service_requests, contact_requests, callback_requests,
--  website_sessions, submit_website_request, touch_website_session,
--  existing RLS policies, or the existing rate limit.
-- ============================================================================

BEGIN;

-- 1) Detach the blocked-IP guard triggers from the existing request tables
DO $$
DECLARE v_tbl text;
BEGIN
  FOREACH v_tbl IN ARRAY ARRAY['service_requests','contact_requests','callback_requests'] LOOP
    IF to_regclass('public.' || v_tbl) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS admin_block_ip_guard ON public.%I', v_tbl);
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY DEFAULT', v_tbl);
    END IF;
  END LOOP;
END $$;

-- 2) Remove admin-only SELECT policies added to the existing tables
DO $$
DECLARE
  v_tbl text; v_policy text;
BEGIN
  FOREACH v_tbl IN ARRAY ARRAY['service_requests','contact_requests','callback_requests'] LOOP
    v_policy := 'admin_read_' || v_tbl;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=v_tbl AND policyname=v_policy) THEN
      EXECUTE format('DROP POLICY %I ON public.%I', v_policy, v_tbl);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_publication_tables
               WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=v_tbl) THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', v_tbl);
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END LOOP;
END $$;

-- 3) Drop read-model views
DROP VIEW IF EXISTS public.admin_all_requests;
DROP VIEW IF EXISTS public.admin_website_sessions;

-- 4) Drop all admin_* functions + helpers created by the migration
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (p.proname LIKE 'admin\_%'
           OR p.proname IN ('is_current_admin','current_admin_role',
                            'get_website_settings','bootstrap_first_super_admin'))
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.fn);
  END LOOP;
END $$;

-- 5) Drop the guard trigger function
DROP FUNCTION IF EXISTS public.admin_block_ip_guard() CASCADE;

-- 6) Drop the NEW admin tables (data inside them will be lost)
DROP TABLE IF EXISTS public.admin_audit_logs;
DROP TABLE IF EXISTS public.admin_login_attempts;
DROP TABLE IF EXISTS public.blocked_ips;
DROP TABLE IF EXISTS public.social_links;
DROP TABLE IF EXISTS public.website_settings;
DROP TABLE IF EXISTS public.admin_profiles;

COMMIT;

-- Verify nothing of yours was touched:
--   \dt public.*        → your 4 core tables still there
--   SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--    WHERE n.nspname='public' AND proname IN ('submit_website_request','touch_website_session');
