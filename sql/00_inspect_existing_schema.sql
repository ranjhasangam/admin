-- ============================================================================
-- SD DIGITAL HUB — PHASE 1: INSPECT EXISTING DATABASE  (READ-ONLY, SAFE)
-- ============================================================================
-- Run this FIRST in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- It changes NOTHING. It only prints the real structure of your existing
-- database so you can verify the Admin Panel migration matches reality:
--
--   * the 4 existing tables  (service_requests, contact_requests,
--                             callback_requests, website_sessions)
--   * their exact column names (incl. the ip-hash column used by the
--     5-requests-per-hour rate limit)
--   * existing functions (submit_website_request, touch_website_session, ...)
--   * enums, triggers, RLS policies, realtime publication
--
-- Keep the results tab open (or copy the outputs) while you run
-- 01_admin_migration.sql. If any name differs from what the migration
-- expects, the migration's defensive DO-blocks adapt automatically and
-- print NOTICEs telling you what it detected.
-- ============================================================================

-- 1) All tables in the public schema + approximate row counts ---------------
SELECT c.relname                                   AS table_name,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
       c.reltuples::bigint                          AS approx_rows
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- 2) Exact columns of the four existing core tables --------------------------
SELECT table_name, ordinal_position, column_name, data_type,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('service_requests','contact_requests',
                     'callback_requests','website_sessions')
ORDER BY table_name, ordinal_position;

-- 3) Any column anywhere that looks like an IP / hash column ------------------
--    (This is what the Blocked-IP guard attaches to.)
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (column_name ILIKE '%ip%' OR column_name ILIKE '%hash%')
ORDER BY table_name, column_name;

-- 4) All enum types + their labels (e.g. the request status enum) ------------
SELECT t.typname                            AS enum_name,
       array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
GROUP BY t.typname;

-- 5) FULL source code of every function in public -----------------------------
--    (submit_website_request, touch_website_session, rate-limit logic, ...)
SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- 6) Existing triggers on the request tables ----------------------------------
SELECT event_object_table AS table_name, trigger_name,
       event_manipulation, action_timing, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 7) Existing RLS policies (must stay untouched) ------------------------------
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 8) Is RLS enabled on the core tables? ---------------------------------------
SELECT relname AS table_name, relrowsecurity AS rls_enabled,
       relforcerowsecurity AS rls_forced
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND relname IN ('service_requests','contact_requests',
                  'callback_requests','website_sessions');

-- 9) Realtime publication membership ------------------------------------------
SELECT pubname, tablename
FROM pg_publication_tables
ORDER BY pubname, tablename;

-- 10) Installed extensions (pgcrypto is needed by the admin migration) --------
SELECT extname, extversion FROM pg_extension ORDER BY extname;

-- 11) Exact current row counts (small tables, safe) ----------------------------
SELECT 'service_requests'  AS t, count(*) FROM public.service_requests
UNION ALL SELECT 'contact_requests',  count(*) FROM public.contact_requests
UNION ALL SELECT 'callback_requests', count(*) FROM public.callback_requests
UNION ALL SELECT 'website_sessions',  count(*) FROM public.website_sessions;

-- 12) How the main website stores business/contact info today (if anywhere) ---
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name ILIKE '%setting%' OR table_name ILIKE '%config%'
       OR table_name ILIKE '%business%' OR table_name ILIKE '%social%'
       OR table_name ILIKE '%seo%' OR table_name ILIKE '%site%');

-- 13) Existing auth users count (admin users will live in the same auth) ------
SELECT count(*) AS auth_users FROM auth.users;

-- ============================================================================
-- WHAT TO CHECK IN THE OUTPUT
-- ============================================================================
-- A. Section 2: confirm each request table has: name, email, phone,
--    business_name, status, created_at (+ service_name / message / details /
--    source_section / price_info variants). The admin migration reads these
--    via JSON extraction with fallbacks, so small naming differences are OK.
-- B. Section 3: note the IP-hash column name on the request tables
--    (expected: ip_hash). The Blocked-IP trigger auto-detects it.
-- C. Section 4: note the status enum name + labels
--    (expected labels: pending, completed, cancelled).
-- D. Section 5: confirm submit_website_request exists and see how the
--    5-per-hour rate limit works — the migration NEVER replaces it.
-- E. Section 10: if pgcrypto is missing, the migration installs it
--    (requires no extra action from you).
-- ============================================================================
