-- ============================================================================
--  SD DIGITAL HUB — ADMIN PANEL MIGRATION  (01)
-- ============================================================================
--  WHAT THIS FILE DOES
--    Adds ONLY the new structures the Admin Panel needs:
--      * admin_profiles            (roles: super_admin / admin / support)
--      * admin_audit_logs          (audit trail of admin actions)
--      * admin_login_attempts      (login rate limiting / lockout)
--      * website_settings          (business + contact info, key/value)
--      * social_links              (Instagram, Facebook, YouTube, ...)
--      * blocked_ips               (DB-level request blocking, ip-hash based)
--      * read models + RPCs        (dashboard, requests, analytics, sessions)
--      * a BEFORE INSERT guard on the EXISTING request tables that rejects
--        submissions from blocked IPs *before* any row is inserted.
--
--  WHAT THIS FILE NEVER DOES
--    * Never recreates service_requests / contact_requests /
--      callback_requests / website_sessions.
--    * Never replaces submit_website_request / touch_website_session.
--    * Never touches the existing 5-requests-per-hour-per-ip-hash rate limit.
--    * Never modifies existing RLS policies.
--    * Stores no raw IP addresses and no passwords.
--
--  HOW TO RUN
--    1. Run your EXISTING main-website SQL first (already done in production).
--    2. Run sql/00_inspect_existing_schema.sql and skim the output.
--    3. Run THIS file in Supabase Dashboard → SQL Editor. It is idempotent:
--       safe to re-run.
--    4. Create the first Super Admin (see bootstrap function at the bottom).
--
--  ONE SUPABASE PROJECT. ONE SOURCE OF TRUTH. NO DUPLICATE REQUEST TABLES.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. SAFETY CHECKS — the existing main-website schema must already be present
-- ============================================================================
DO $$
DECLARE v_missing text[] := ARRAY[]::text[];
BEGIN
  IF to_regclass('public.service_requests')  IS NULL THEN v_missing := v_missing || 'service_requests';  END IF;
  IF to_regclass('public.contact_requests')  IS NULL THEN v_missing := v_missing || 'contact_requests';  END IF;
  IF to_regclass('public.callback_requests') IS NULL THEN v_missing := v_missing || 'callback_requests'; END IF;
  IF to_regclass('public.website_sessions')  IS NULL THEN v_missing := v_missing || 'website_sessions';  END IF;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'ABORTED: existing main-website table(s) % not found. Run your existing main-website SQL FIRST, then re-run this migration.', array_to_string(v_missing, ', ');
  END IF;
  RAISE NOTICE 'OK: all four existing tables found. Proceeding (they will NOT be modified).';
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================================
-- 1. ADMIN PROFILES + ROLE / PERMISSION HELPERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_profiles (
  id                  uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email               text NOT NULL,
  full_name           text,
  role                text NOT NULL DEFAULT 'admin'
                        CHECK (role IN ('super_admin','admin','support')),
  is_active           boolean NOT NULL DEFAULT true,
  can_delete_requests boolean NOT NULL DEFAULT false,
  can_update_status   boolean NOT NULL DEFAULT true,
  last_login_at       timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_profiles_role_idx ON public.admin_profiles (role);

COMMENT ON TABLE public.admin_profiles IS
  'Maps Supabase Auth users to Admin Panel roles. Same Supabase project as the main website — no second auth system.';

-- Is the current JWT an ACTIVE admin? (SECURITY DEFINER: avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_current_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_profiles p
    WHERE p.id = auth.uid() AND p.is_active
  );
$$;

CREATE OR REPLACE FUNCTION public.current_admin_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.role FROM public.admin_profiles p
  WHERE p.id = auth.uid() AND p.is_active;
$$;

-- The single server-side permission gate. Every admin RPC below calls this,
-- so permissions are enforced in the DATABASE, not by hiding frontend buttons.
CREATE OR REPLACE FUNCTION public.admin_can(p_permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN p.role = 'super_admin' THEN true
      WHEN p.role = 'admin' THEN
           p_permission IN ('view_requests','update_status','export_data',
                            'view_settings','view_sessions','view_blocked_ips',
                            'view_audit')
        OR (p_permission = 'delete_requests' AND p.can_delete_requests)
      WHEN p.role = 'support' THEN
           p_permission IN ('view_requests','view_sessions')
        OR (p_permission = 'update_status' AND p.can_update_status)
      ELSE false
    END
    FROM public.admin_profiles p
    WHERE p.id = auth.uid() AND p.is_active
  ), false);
$$;

ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND policyname='admin_profiles_select' AND tablename='admin_profiles') THEN
    CREATE POLICY admin_profiles_select ON public.admin_profiles
      FOR SELECT TO authenticated
      USING (id = auth.uid() OR public.admin_can('manage_admins'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND policyname='admin_profiles_write' AND tablename='admin_profiles') THEN
    CREATE POLICY admin_profiles_write ON public.admin_profiles
      FOR ALL TO authenticated
      USING (public.admin_can('manage_admins'))
      WITH CHECK (public.admin_can('manage_admins'));
  END IF;
END $$;

-- ============================================================================
-- 2. AUDIT LOG  (never stores passwords; stores hashes at most)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id    uuid,
  admin_email text,
  action      text NOT NULL,
  section     text,
  record_id   text,
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_created_idx  ON public.admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_section_idx  ON public.admin_audit_logs (section);
CREATE INDEX IF NOT EXISTS admin_audit_admin_idx    ON public.admin_audit_logs (admin_id);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND policyname='admin_audit_select' AND tablename='admin_audit_logs') THEN
    CREATE POLICY admin_audit_select ON public.admin_audit_logs
      FOR SELECT TO authenticated USING (public.admin_can('view_audit'));
  END IF;
END $$;

-- Internal writer (called from gated SECURITY DEFINER functions only).
CREATE OR REPLACE FUNCTION public.admin_audit_internal(
  p_action    text,
  p_section   text,
  p_record_id text,
  p_details   jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_email text;
BEGIN
  SELECT p.email INTO v_email FROM public.admin_profiles p WHERE p.id = auth.uid();
  INSERT INTO public.admin_audit_logs (admin_id, admin_email, action, section, record_id, details)
  VALUES (auth.uid(), v_email, p_action, p_section, p_record_id, coalesce(p_details,'{}'::jsonb));
END $$;

-- App-callable (login / logout events), gated: must be an active admin.
CREATE OR REPLACE FUNCTION public.admin_record_audit(
  p_action    text,
  p_section   text,
  p_record_id text DEFAULT NULL,
  p_details   jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_current_admin() THEN
    RAISE EXCEPTION 'insufficient_permission' USING ERRCODE = '42501';
  END IF;
  PERFORM public.admin_audit_internal(p_action, p_section, p_record_id, p_details);
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_audit_logs(
  p_search    text        DEFAULT NULL,
  p_section   text        DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to   timestamptz DEFAULT NULL,
  p_page      int         DEFAULT 1,
  p_page_size int         DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_page int := greatest(1, coalesce(p_page,1));
  v_size int := least(100, greatest(1, coalesce(p_page_size,20)));
  v_search text := nullif(btrim(coalesce(p_search,'')),'');
  v_result jsonb;
BEGIN
  IF NOT public.admin_can('view_audit') THEN
    RAISE EXCEPTION 'insufficient_permission' USING ERRCODE = '42501';
  END IF;

  WITH filtered AS (
    SELECT a.id, a.admin_id, a.admin_email, a.action, a.section, a.record_id,
           a.details, a.created_at,
           p.full_name AS admin_name
    FROM public.admin_audit_logs a
    LEFT JOIN public.admin_profiles p ON p.id = a.admin_id
    WHERE (p_section IS NULL OR a.section = p_section)
      AND (p_date_from IS NULL OR a.created_at >= p_date_from)
      AND (p_date_to   IS NULL OR a.created_at <  p_date_to)
      AND (v_search IS NULL OR (
            coalesce(a.action,'')      ILIKE '%'||v_search||'%'
         OR coalesce(a.section,'')     ILIKE '%'||v_search||'%'
         OR coalesce(a.admin_email,'') ILIKE '%'||v_search||'%'
         OR coalesce(a.record_id,'')   ILIKE '%'||v_search||'%'
         OR coalesce(a.details::text,'') ILIKE '%'||v_search||'%'))
  )
  SELECT jsonb_build_object(
    'total',     (SELECT count(*) FROM filtered),
    'page',      v_page,
    'page_size', v_size,
    'pages',     greatest(1, ceiling((SELECT count(*) FROM filtered)::numeric / v_size)::int),
    'rows',      coalesce((
        SELECT jsonb_agg(to_jsonb(r)) FROM (
          SELECT f.* FROM filtered f
          ORDER BY f.created_at DESC, f.id DESC
          LIMIT v_size OFFSET (v_page - 1) * v_size
        ) r), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END $$;

-- ============================================================================
-- 3. LOGIN ATTEMPTS (app-level rate limiting; Supabase Auth adds its own)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email      text NOT NULL,
  ip_hash    text,
  success    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_attempts_email_idx ON public.admin_login_attempts (email, created_at DESC);
CREATE INDEX IF NOT EXISTS login_attempts_ip_idx    ON public.admin_login_attempts (ip_hash, created_at DESC);

ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;
-- No policies at all: only the service role (server-only) can read/write this.

-- ============================================================================
-- 4. WEBSITE SETTINGS + SOCIAL LINKS
--    The main website reads these through the public RPC
--    get_website_settings() → change once in the Admin Panel, the website
--    updates automatically. No redeploy, no code edits, no second source.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.website_settings (
  key              text PRIMARY KEY CHECK (key IN (
                     'business_name','business_description',
                     'phone','email','whatsapp',
                     'address','city','state','pincode','country')),
  value            text,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  updated_by_email text
);

CREATE TABLE IF NOT EXISTS public.social_links (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform   text NOT NULL,
  url        text NOT NULL,
  label      text,
  is_visible boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS social_links_platform_uidx ON public.social_links (lower(platform));

ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_links     ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND policyname='website_settings_select' AND tablename='website_settings') THEN
    CREATE POLICY website_settings_select ON public.website_settings
      FOR SELECT TO authenticated USING (public.admin_can('view_settings'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND policyname='social_links_select' AND tablename='social_links') THEN
    CREATE POLICY social_links_select ON public.social_links
      FOR SELECT TO authenticated USING (public.admin_can('view_settings'));
  END IF;
END $$;

-- PUBLIC read path for the MAIN WEBSITE (no auth required, read-only,
-- exposes only public business info + visible social links; never secrets).
CREATE OR REPLACE FUNCTION public.get_website_settings()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_out jsonb;
BEGIN
  SELECT jsonb_build_object(
    'settings', coalesce((SELECT jsonb_object_agg(s.key, s.value)
                          FROM public.website_settings s), '{}'::jsonb),
    'social_links', coalesce((SELECT jsonb_agg(jsonb_build_object(
                                'id', l.id, 'platform', l.platform, 'url', l.url,
                                'label', l.label, 'sort_order', l.sort_order)
                                ORDER BY l.sort_order, l.platform)
                              FROM public.social_links l
                              WHERE l.is_visible), '[]'::jsonb),
    'updated_at', (SELECT max(updated_at) FROM public.website_settings)
  ) INTO v_out;
  RETURN v_out;
END $$;

CREATE OR REPLACE FUNCTION public.admin_get_settings()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.admin_can('view_settings') THEN
    RAISE EXCEPTION 'insufficient_permission' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((SELECT jsonb_object_agg(key, value) FROM public.website_settings), '{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_setting(p_key text, p_value text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_old text;
  v_email text;
BEGIN
  IF NOT public.admin_can('manage_settings') THEN
    RAISE EXCEPTION 'insufficient_permission' USING ERRCODE = '42501';
  END IF;
  IF p_key NOT IN ('business_name','business_description','phone','email','whatsapp',
                   'address','city','state','pincode','country') THEN
    RAISE EXCEPTION 'invalid_setting_key' USING ERRCODE = '22023';
  END IF;

  SELECT value INTO v_old FROM public.website_settings WHERE key = p_key;
  SELECT email INTO v_email FROM public.admin_profiles WHERE id = auth.uid();

  INSERT INTO public.website_settings (key, value, updated_at, updated_by, updated_by_email)
  VALUES (p_key, nullif(btrim(p_value),''), now(), auth.uid(), v_email)
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now(),
        updated_by = EXCLUDED.updated_by, updated_by_email = EXCLUDED.updated_by_email;

  PERFORM public.admin_audit_internal('settings.update', 'website_settings', p_key,
            jsonb_build_object('key', p_key, 'old', v_old, 'new', nullif(btrim(p_value),'')));
  RETURN jsonb_build_object('ok', true, 'key', p_key);
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_social_links()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.admin_can('view_settings') THEN
    RAISE EXCEPTION 'insufficient_permission' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.sort_order, l.platform)
                   FROM public.social_links l), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.admin_upsert_social_link(
  p_id         uuid,
  p_platform   text,
  p_url        text,
  p_label      text DEFAULT NULL,
  p_is_visible boolean DEFAULT true,
  p_sort_order int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_platform text := lower(btrim(coalesce(p_platform,'')));
  v_url      text := btrim(coalesce(p_url,''));
  v_id       uuid;
BEGIN
  IF NOT public.admin_can('manage_settings') THEN
    RAISE EXCEPTION 'insufficient_permission' USING ERRCODE = '42501';
  END IF;
  IF v_platform = '' OR length(v_platform) > 40 THEN
    RAISE EXCEPTION 'invalid_platform' USING ERRCODE = '22023';
  END IF;
  IF v_url = '' OR NOT (v_url ~* '^(https?://|wa\.me/|mailto:|tel:)') THEN
    RAISE EXCEPTION 'invalid_url' USING ERRCODE = '22023',
      HINT = 'URL must start with https://, http://, wa.me/, mailto: or tel:';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.social_links (platform, url, label, is_visible, sort_order)
    VALUES (v_platform, v_url, nullif(btrim(p_label),''), coalesce(p_is_visible,true), coalesce(p_sort_order,0))
    RETURNING id INTO v_id;
    PERFORM public.admin_audit_internal('social.create', 'social_links', v_id::text,
              jsonb_build_object('platform', v_platform, 'url', v_url));
  ELSE
    UPDATE public.social_links
       SET platform = v_platform, url = v_url,
           label = nullif(btrim(p_label),''),
           is_visible = coalesce(p_is_visible, is_visible),
           sort_order = coalesce(p_sort_order, sort_order),
           updated_at = now()
     WHERE id = p_id
     RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'social_link_not_found' USING ERRCODE = 'P0002'; END IF;
    PERFORM public.admin_audit_internal('social.update', 'social_links', v_id::text,
              jsonb_build_object('platform', v_platform, 'url', v_url, 'visible', p_is_visible));
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_social_link(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row public.social_links;
BEGIN
  IF NOT public.admin_can('manage_settings') THEN
    RAISE EXCEPTION 'insufficient_permission' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.social_links WHERE id = p_id RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'social_link_not_found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.admin_audit_internal('social.delete', 'social_links', p_id::text,
            jsonb_build_object('platform', v_row.platform, 'url', v_row.url));
  RETURN jsonb_build_object('ok', true);
END $$;

-- ============================================================================
-- 5. BLOCKED IPs  (same ip-hash architecture as the existing rate limiter;
--    raw IPs are NOT stored — only hashes produced by admin_hash_ip())
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.blocked_ips (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash          text NOT NULL UNIQUE,
  label            text,
  reason           text,
  is_active        boolean NOT NULL DEFAULT true,
  expires_at       timestamptz,
  blocked_by       uuid,
  blocked_by_email text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blocked_ips_active_idx ON public.blocked_ips (is_active);

ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND policyname='blocked_ips_select' AND tablename='blocked_ips') THEN
    CREATE POLICY blocked_ips_select ON public.blocked_ips
      FOR SELECT TO authenticated USING (public.admin_can('view_blocked_ips'));
  END IF;
END $$;

-- *** IMPORTANT ***
-- This MUST produce the same hash your main website already uses for its
-- 5-requests-per-hour limiter (the migration detected an ip-hash column in
-- your request tables). Default = plain SHA-256 hex of the trimmed IP.
-- If your main website hashes differently (salt, md5, app-side hashing...),
-- adjust ONLY this function body — the rest of the system follows automatically.
CREATE OR REPLACE FUNCTION public.admin_hash_ip(p_ip text)
RETURNS text
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = public, extensions
AS $$
  SELECT encode(digest(btrim(p_ip), 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.admin_list_blocked_ips(
  p_active_only boolean DEFAULT false,
  p_search      text    DEFAULT NULL,
  p_page        int     DEFAULT 1,
  p_page_size   int     DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_page int := greatest(1, coalesce(p_page,1));
  v_size int := least(100, greatest(1, coalesce(p_page_size,20)));
  v_search text := nullif(btrim(coalesce(p_search,'')),'');
  v_result jsonb;
BEGIN
  IF NOT public.admin_can('view_blocked_ips') THEN
    RAISE EXCEPTION 'insufficient_permission' USING ERRCODE = '42501';
  END IF;

  WITH filtered AS (
    SELECT b.id, b.ip_hash, b.label, b.reason, b.is_active, b.expires_at,
           b.blocked_by, b.blocked_by_email, b.created_at,
           (b.is_active AND (b.expires_at IS NULL OR b.expires_at > now())) AS currently_blocked
    FROM public.blocked_ips b
    WHERE (NOT coalesce(p_active_only,false)
           OR (b.is_active AND (b.expires_at IS NULL OR b.expires_at > now())))
      AND (v_search IS NULL OR (
            coalesce(b.ip_hash,'')  ILIKE '%'||v_search||'%'
         OR coalesce(b.label,'')    ILIKE '%'||v_search||'%'
         OR coalesce(b.reason,'')   ILIKE '%'||v_search||'%'
         OR coalesce(b.blocked_by_email,'') ILIKE '%'||v_search||'%'))
  )
  SELECT jsonb_build_object(
    'total',     (SELECT count(*) FROM filtered),
    'page',      v_page,
    'page_size', v_size,
    'pages',     greatest(1, ceiling((SELECT count(*) FROM filtered)::numeric / v_size)::int),
    'rows',      coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM (
                   SELECT f.* FROM filtered f
                   ORDER BY f.created_at DESC
                   LIMIT v_size OFFSET (v_page-1)*v_size) r), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.admin_block_ip(
  p_ip         text,
  p_reason     text DEFAULT NULL,
  p_label      text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_email text;
  v_row public.blocked_ips;
BEGIN
  IF NOT public.admin_can('manage_blocked_ips') THEN
    RAISE EXCEPTION 'insufficient_permission' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce(p_ip,'')),'') IS NULL THEN
    RAISE EXCEPTION 'ip_required' USING ERRCODE = '22023';
  END IF;

  -- Accept either a raw IP (hashed here, raw value NOT stored) or an
  -- already-computed 64-char hex hash (e.g. copied from website_sessions).
  IF btrim(p_ip) ~* '^[0-9a-f]{64}$' THEN
    v_hash := lower(btrim(p_ip));
  ELSE
    v_hash := public.admin_hash_ip(p_ip);
  END IF;

  SELECT a.email INTO v_email FROM public.admin_profiles a WHERE a.id = auth.uid();

  INSERT INTO public.blocked_ips AS b (ip_hash, label, reason, is_active, expires_at,
                                       blocked_by, blocked_by_email, created_at)
  VALUES (v_hash, nullif(btrim(p_label),''), nullif(btrim(p_reason),''), true,
          p_expires_at, auth.uid(), v_email, now())
  ON CONFLICT (ip_hash) DO UPDATE SET
    is_active = true,
    reason    = EXCLUDED.reason,
    label     = EXCLUDED.label,
    expires_at = EXCLUDED.expires_at,
    blocked_by = EXCLUDED.blocked_by,
    blocked_by_email = EXCLUDED.blocked_by_email,
    created_at = now()
  RETURNING * INTO v_row;

  PERFORM public.admin_audit_internal('security.ip_blocked', 'blocked_ips', v_row.id::text,
            jsonb_build_object('ip_hash', v_hash, 'label', v_row.label,
                               'reason', v_row.reason, 'expires_at', v_row.expires_at));
  RETURN to_jsonb(v_row);
END $$;

CREATE OR REPLACE FUNCTION public.admin_unblock_ip(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row public.blocked_ips;
BEGIN
  IF NOT public.admin_can('manage_blocked_ips') THEN
    RAISE EXCEPTION 'insufficient_permission' USING ERRCODE = '42501';
  END IF;
  UPDATE public.blocked_ips SET is_active = false WHERE id = p_id RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'blocked_ip_not_found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.admin_audit_internal('security.ip_unblocked', 'blocked_ips', p_id::text,
            jsonb_build_object('ip_hash', v_row.ip_hash, 'label', v_row.label));
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_blocked_ip(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row public.blocked_ips;
BEGIN
  IF NOT public.admin_can('manage_blocked_ips') THEN
    RAISE EXCEPTION 'insufficient_permission' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.blocked_ips WHERE id = p_id RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'blocked_ip_not_found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.admin_audit_internal('security.ip_removed', 'blocked_ips', p_id::text,
            jsonb_build_object('ip_hash', v_row.ip_hash));
  RETURN jsonb_build_object('ok', true);
END $$;

-- ----------------------------------------------------------------------------
-- 5b. DB-LEVEL ENFORCEMENT: reject blocked IPs BEFORE any request row exists.
--     One shared trigger function; the DO-block attaches it to each EXISTING
--     request table using the table's REAL ip-hash column (auto-detected).
--     submit_website_request is NOT modified — the trigger fires on every
--     insert path, including that function. The 5/hour rate limit is untouched.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_block_ip_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hash text := to_jsonb(NEW) ->> TG_ARGV[0];
BEGIN
  IF v_hash IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.blocked_ips b
    WHERE b.is_active AND b.ip_hash = v_hash
      AND (b.expires_at IS NULL OR b.expires_at > now())
  ) THEN
    RAISE EXCEPTION 'REQUEST_BLOCKED_IP'
      USING ERRCODE = '42501',
            HINT = 'This IP address has been blocked by the site administrator. No request record was created.';
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE
  v_tbl text;
  v_col text;
  v_candidate text;
  v_candidates text[] := ARRAY['ip_hash','iphash','client_ip_hash','ip_address_hash','visitor_ip_hash'];
BEGIN
  FOREACH v_tbl IN ARRAY ARRAY['service_requests','contact_requests','callback_requests'] LOOP
    IF to_regclass('public.' || v_tbl) IS NULL THEN CONTINUE; END IF;
    v_col := NULL;
    FOREACH v_candidate IN ARRAY v_candidates LOOP
      IF EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name=v_tbl AND column_name=v_candidate) THEN
        v_col := v_candidate; EXIT;
      END IF;
    END LOOP;
    IF v_col IS NULL THEN
      RAISE NOTICE 'block-guard: no ip-hash column detected on "%" — trigger NOT attached. Check sql/00_inspect_existing_schema.sql section 3 and adjust the candidate list if your column has another name.', v_tbl;
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS admin_block_ip_guard ON public.%I', v_tbl);
    EXECUTE format('CREATE TRIGGER admin_block_ip_guard
                      BEFORE INSERT ON public.%I
                      FOR EACH ROW EXECUTE FUNCTION public.admin_block_ip_guard(%L)',
                   v_tbl, v_col);
    RAISE NOTICE 'block-guard: attached to % (column: %)', v_tbl, v_col;
  END LOOP;
END $$;

-- ============================================================================
-- 6. UNIFIED REQUEST READ-MODEL (a VIEW over the EXISTING tables —
--    zero data duplication, zero sync). JSON extraction with fallbacks makes
--    it resilient to your exact column naming (verified in Phase 1).
-- ============================================================================
DROP VIEW IF EXISTS public.admin_all_requests;
CREATE VIEW public.admin_all_requests
WITH (security_invoker = true)
AS
SELECT u.* FROM (
  SELECT
    'service'::text                       AS request_type,
    (x.d ->> 'id')::text                  AS request_id,
    x.d ->> 'name'                        AS name,
    x.d ->> 'email'                       AS email,
    x.d ->> 'phone'                       AS phone,
    COALESCE(x.d->>'business_name', x.d->>'company_name', x.d->>'company', x.d->>'business')            AS business_name,
    COALESCE(x.d->>'service_name',  x.d->>'service')                                                    AS service_name,
    COALESCE(x.d->>'details', x.d->>'additional_details', x.d->>'message', x.d->>'notes', x.d->>'description') AS details,
    COALESCE(x.d->>'source_section', x.d->>'source', x.d->>'section', x.d->>'page_section')             AS source_section,
    COALESCE(x.d->>'price_info', x.d->>'price_information', x.d->>'price', x.d->>'pricing', x.d->>'budget') AS price_info,
    x.d ->> 'status'                      AS status,
    COALESCE(x.d->>'created_at',  x.d->>'submitted_at')::timestamptz AS created_at,
    COALESCE(x.d->>'updated_at',  x.d->>'last_updated_at')::timestamptz AS updated_at
  FROM public.service_requests r
  CROSS JOIN LATERAL (SELECT to_jsonb(r) AS d) x

  UNION ALL
  SELECT
    'contact'::text,
    (x.d ->> 'id')::text,
    x.d ->> 'name',
    x.d ->> 'email',
    x.d ->> 'phone',
    COALESCE(x.d->>'business_name', x.d->>'company_name', x.d->>'company', x.d->>'business'),
    COALESCE(x.d->>'service_name',  x.d->>'service'),
    COALESCE(x.d->>'message', x.d->>'details', x.d->>'additional_details', x.d->>'notes', x.d->>'description'),
    COALESCE(x.d->>'source_section', x.d->>'source', x.d->>'section', x.d->>'page_section'),
    COALESCE(x.d->>'price_info', x.d->>'price_information', x.d->>'price', x.d->>'pricing', x.d->>'budget'),
    x.d ->> 'status',
    COALESCE(x.d->>'created_at',  x.d->>'submitted_at')::timestamptz,
    COALESCE(x.d->>'updated_at',  x.d->>'last_updated_at')::timestamptz
  FROM public.contact_requests r
  CROSS JOIN LATERAL (SELECT to_jsonb(r) AS d) x

  UNION ALL
  SELECT
    'callback'::text,
    (x.d ->> 'id')::text,
    x.d ->> 'name',
    x.d ->> 'email',
    x.d ->> 'phone',
    COALESCE(x.d->>'business_name', x.d->>'company_name', x.d->>'company', x.d->>'business'),
    COALESCE(x.d->>'service_name',  x.d->>'service'),
    COALESCE(x.d->>'additional_details', x.d->>'details', x.d->>'message', x.d->>'notes', x.d->>'description'),
    COALESCE(x.d->>'source_section', x.d->>'source', x.d->>'section', x.d->>'page_section'),
    COALESCE(x.d->>'price_info', x.d->>'price_information', x.d->>'price', x.d->>'pricing', x.d->>'budget'),
    x.d ->> 'status',
    COALESCE(x.d->>'created_at',  x.d->>'submitted_at')::timestamptz,
    COALESCE(x.d->>'updated_at',  x.d->>'last_updated_at')::timestamptz
  FROM public.callback_requests r
  CROSS JOIN LATERAL (SELECT to_jsonb(r) AS d) x
) u;

-- The view must NEVER be directly readable by anon/authenticated:
-- admins only access it through the gated RPCs below.
REVOKE ALL ON PUBLIC.admin_all_requests FROM PUBLIC;
REVOKE ALL ON PUBLIC.admin_all_requests FROM anon;
REVOKE ALL ON PUBLIC.admin_all_requests FROM authenticated;
GRANT  SELECT ON PUBLIC.admin_all_requests TO service_role;

-- Shared filtered set used by list + export (so exports ALWAYS respect the
-- exact same server-side filters as the table on screen).
-- NOTE: plpgsql + RETURNS TABLE with base types on purpose → the function
-- carries NO catalog dependency on the view, keeping this migration safely
-- re-runnable (DROP VIEW ... would otherwise fail).
CREATE OR REPLACE FUNCTION public.admin_requests_filtered(
  p_types     text[]      DEFAULT NULL,
  p_statuses  text[]      DEFAULT NULL,
  p_search    text        DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to   timestamptz DEFAULT NULL,
  p_service   text        DEFAULT NULL,
  p_source    text        DEFAULT NULL,
  p_ids       text[]      DEFAULT NULL
)
RETURNS TABLE(
  request_type   text,
  request_id     text,
  name           text,
  email          text,
  phone          text,
  business_name  text,
  service_name   text,
  details        text,
  source_section text,
  price_info     text,
  status         text,
  created_at     timestamptz,
  updated_at     timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_search text := nullif(btrim(coalesce(p_search,'')),'');
BEGIN
  RETURN QUERY
  SELECT v.request_type, v.request_id, v.name, v.email, v.phone,
         v.business_name, v.service_name, v.details, v.source_section,
         v.price_info, v.status, v.created_at, v.updated_at
  FROM public.admin_all_requests v
  WHERE (p_types     IS NULL OR v.request_type = ANY (p_types))
    AND (p_statuses  IS NULL OR v.status       = ANY (p_statuses))
    AND (p_ids       IS NULL OR v.request_id   = ANY (p_ids))
    AND (p_date_from IS NULL OR v.created_at  >= p_date_from)
    AND (p_date_to   IS NULL OR v.created_at   < p_date_to)
    AND (p_service   IS NULL OR v.service_name   = p_service)
    AND (p_source    IS NULL OR v.source_section = p_source)
    AND (v_search IS NULL OR (
            coalesce(v.name,'')          ILIKE '%'||v_search||'%'
         OR coalesce(v.email,'')         ILIKE '%'||v_search||'%'
         OR coalesce(v.phone,'')         ILIKE '%'||v_search||'%'
         OR coalesce(v.business_name,'') ILIKE '%'||v_search||'%'
         OR coalesce(v.service_name,'')  ILIKE '%'||v_search||'%'
         OR coalesce(v.request_id,'')    ILIKE '%'||v_search||'%'
         OR coalesce(v.details,'')       ILIKE '%'||v_search||'%'));
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_requests(
  p_types     text[]      DEFAULT NULL,
  p_statuses  text[]      DEFAULT NULL,
  p_search    text        DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to   timestamptz DEFAULT NULL,
  p_service   text        DEFAULT NULL,
  p_source    text        DEFAULT NULL,
  p_sort      text        DEFAULT 'newest',
  p_page      int         DEFAULT 1,
  p_page_size int         DEFAULT 20,
  p_ids       text[]      DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_page int := greatest(1, coalesce(p_page,1));
  v_size int := least(100, greatest(1, coalesce(p_page_size,20)));
  v_result jsonb;
BEGIN
  IF NOT public.admin_can('view_requests') THEN
    RAISE EXCEPTION 'insufficient_permission' USING ERRCODE = '42501';
  END IF;

  WITH filtered AS (
    SELECT f.* FROM public.admin_requests_filtered(
      p_types, p_statuses, p_search, p_date_from, p_date_to, p_service, p_source, p_ids) f
  ),
  paged AS (
    SELECT f.* FROM filtered f
    ORDER BY
      CASE WHEN p_sort = 'oldest'    THEN f.created_at END ASC  NULLS LAST,
      CASE WHEN p_sort = 'oldest'    THEN f.request_id END ASC,
      CASE WHEN p_sort IS NULL OR p_sort = 'newest' THEN f.created_at END DESC NULLS LAST,
      CASE WHEN p_sort = 'name_asc'  THEN lower(coalesce(f.name,'')) END ASC  NULLS LAST,
      CASE WHEN p_sort = 'name_desc' THEN lower(coalesce(f.name,'')) END DESC NULLS FIRST,
      CASE WHEN p_sort = 'status'    THEN f.status END ASC NULLS FIRST,
      CASE WHEN p_sort = 'status'    THEN f.created_at END DESC,
      CASE WHEN p_sort = 'updated'   THEN f.updated_at END DESC NULLS LAST,
      CASE WHEN p_sort = 'updated'   THEN f.created_at END DESC NULLS LAST,
      f.created_at DESC NULLS LAST
    LIMIT v_size OFFSET (v_page - 1) * v_size
  )
  SELECT jsonb_build_object(
    'total',     (SELECT count(*) FROM filtered),
    'page',      v_page,
    'page_size', v_size,
    'pages',     greatest(1, ceiling((SELECT count(*) FROM filtered)::numeric / v_size)::int),
    'rows',      coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM paged p), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END $$;

-- Export query: identical filters, NO pagination (capped at 100k rows).
CREATE OR REPLACE FUNCTION public.admin_export_requests(
  p_types     text[]      DEFAULT NULL,
  p_statuses  text[]      DEFAULT NULL,
  p_search    text        DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to   timestamptz DEFAULT NULL,
  p_service   text        DEFAULT NULL,
  p_source    text        DEFAULT NULL,
  p_sort      text        DEFAULT 'newest',
  p_ids       text[]      DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_rows jsonb;
BEGIN
  IF NOT public.admin_can('export_data') THEN
    RAISE EXCEPTION 'insufficient_permission' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT f.* FROM public.admin_requests_filtered(
      p_types, p_statuses, p_search, p_date_from, p_date_to, p_service, p_source, p_ids) f
    ORDER BY
      CASE WHEN p_sort = 'oldest' THEN f.created_at END ASC NULLS LAST,
      CASE WHEN p_sort IS NULL OR p_sort = 'newest' THEN f.created_at END DESC NULLS LAST,
      CASE WHEN p_sort = 'name_asc'  THEN lower(coalesce(f.name,'')) END ASC NULLS LAST,
      CASE WHEN p_sort = 'name_desc' THEN lower(coalesce(f.name,'')) END DESC NULLS FIRST,
      f.created_at DESC NULLS LAST
    LIMIT 100000
  ) e;

  RETURN v_rows;
END $$;

CREATE OR REPLACE FUNCTION public.admin_get_request(p_type text, p_id text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tbl text;
  v_data jsonb;
BEGIN
  IF NOT public.admin_can('view_requests') THEN
    RAISE EXCEPTION 'insufficient_permission' USING ERRCODE = '42501';
  END IF;
  v_tbl := CASE p_type
             WHEN 'service'  THEN 'service_requests'
             WHEN 'contact'  THEN 'contact_requests'
             WHEN 'callback' THEN 'callback_requests'
           END;
  IF v_tbl IS NULL THEN
    RAISE EXCEPTION 'invalid_request_type' USING ERRCODE = '22023';
  END IF;

  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE t.id::text = %L LIMIT 1', v_tbl, p_id)
  INTO v_data;
  IF v_data IS NULL THEN
    RAISE EXCEPTION 'request_not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object('request_type', p_type, 'request_id', p_id,
                            'table_name', v_tbl, 'data', v_data);
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_request_status(
  p_type text, p_id text, p_status text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tbl text;
  v_stype text;
  v_has_updated boolean;
  v_old_status text;
  v_name text;
  v_n int;
BEGIN
  IF NOT public.admin_can('update_status') THEN
    RAISE EXCEPTION 'insufficient_permission' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('pending','completed','cancelled') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023',
      HINT = 'Allowed values: pending, completed, cancelled';
  END IF;
  v_tbl := CASE p_type
             WHEN 'service'  THEN 'service_requests'
             WHEN 'contact'  THEN 'contact_requests'
             WHEN 'callback' THEN 'callback_requests'
           END;
  IF v_tbl IS NULL THEN RAISE EXCEPTION 'invalid_request_type' USING ERRCODE='22023'; END IF;

  -- Respect the EXISTING status column type (text or your status enum).
  SELECT format_type(a.atttypid, a.atttypmod) INTO v_stype
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname='public' AND c.relname=v_tbl AND a.attname='status'
    AND a.attnum > 0 AND NOT a.attisdropped;
  IF v_stype IS NULL THEN
    RAISE EXCEPTION 'status_column_missing' USING ERRCODE = '42703';
  END IF;

  EXECUTE format('SELECT status::text, to_jsonb(t)->>''name''
                    FROM public.%I t WHERE t.id::text = %L', v_tbl, p_id)
  INTO v_old_status, v_name;
  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'request_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_old_status = p_status THEN
    RETURN jsonb_build_object('ok', true, 'unchanged', true);
  END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name=v_tbl AND column_name='updated_at')
  INTO v_has_updated;

  EXECUTE format('UPDATE public.%I SET status = %L::%s%s WHERE id::text = %L',
                 v_tbl, p_status, v_stype,
                 CASE WHEN v_has_updated THEN ', updated_at = now()' ELSE '' END,
                 p_id);
  GET DIAGNOSTICS v_n = ROW_COUNT;

  PERFORM public.admin_audit_internal('request.status_changed', 'requests',
            p_type || ':' || p_id,
            jsonb_build_object('request_type', p_type, 'request_id', p_id,
                               'name', v_name, 'from', v_old_status, 'to', p_status));
  RETURN jsonb_build_object('ok', true, 'updated', v_n, 'from', v_old_status, 'to', p_status);
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_request(p_type text, p_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tbl text;
  v_snap jsonb;
  v_n int;
BEGIN
  IF NOT public.admin_can('delete_requests') THEN
    RAISE EXCEPTION 'insufficient_permission' USING ERRCODE = '42501';
  END IF;
  v_tbl := CASE p_type
             WHEN 'service'  THEN 'service_requests'
             WHEN 'contact'  THEN 'contact_requests'
             WHEN 'callback' THEN 'callback_requests'
           END;
  IF v_tbl IS NULL THEN RAISE EXCEPTION 'invalid_request_type' USING ERRCODE='22023'; END IF;

  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE t.id::text = %L', v_tbl, p_id)
  INTO v_snap;
  IF v_snap IS NULL THEN RAISE EXCEPTION 'request_not_found' USING ERRCODE='P0002'; END IF;

  EXECUTE format('DELETE FROM public.%I WHERE id::text = %L', v_tbl, p_id);
  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- Keep a forensic snapshot of the deleted record inside the audit log.
  PERFORM public.admin_audit_internal('request.deleted', 'requests',
            p_type || ':' || p_id,
            jsonb_build_object('request_type', p_type, 'request_id', p_id,
                               'name', v_snap->>'name', 'email', v_snap->>'email',
                               'status', v_snap->>'status', 'record', v_snap));
  RETURN jsonb_build_object('ok', true, 'deleted', v_n);
END $$;

-- Bulk operations: p_items = [{"type":"service","id":"..."}, ...]
CREATE OR REPLACE FUNCTION public.admin_bulk_request_status(p_items jsonb, p_status text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_count int := 0;
BEGIN
  IF NOT public.admin_can('update_status') THEN
    RAISE EXCEPTION 'insufficient_permission' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('pending','completed','cancelled') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'no_items' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_items) > 1000 THEN
    RAISE EXCEPTION 'too_many_items' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    BEGIN
      PERFORM public.admin_set_request_status(v_item->>'type', v_item->>'id', p_status);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- skip rows that vanished meanwhile; keep bulk operation resilient
      NULL;
    END;
  END LOOP;

  PERFORM public.admin_audit_internal('request.bulk_status', 'requests', NULL,
            jsonb_build_object('status', p_status, 'count', v_count));
  RETURN jsonb_build_object('ok', true, 'updated', v_count);
END $$;

CREATE OR REPLACE FUNCTION public.admin_bulk_delete_requests(p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_count int := 0;
BEGIN
  IF NOT public.admin_can('delete_requests') THEN
    RAISE EXCEPTION 'insufficient_permission' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'no_items' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_items) > 1000 THEN
    RAISE EXCEPTION 'too_many_items' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    BEGIN
      PERFORM public.admin_delete_request(v_item->>'type', v_item->>'id');
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  PERFORM public.admin_audit_internal('request.bulk_deleted', 'requests', NULL,
            jsonb_build_object('count', v_count));
  RETURN jsonb_build_object('ok', true, 'deleted', v_count);
END $$;

CREATE OR REPLACE FUNCTION public.admin_filter_options()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.admin_can('view_requests') THEN
    RAISE EXCEPTION 'insufficient_permission' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'services', coalesce((
        SELECT jsonb_agg(jsonb_build_object('name', s.service_name, 'count', s.c) ORDER BY s.c DESC)
        FROM (SELECT service_name, count(*) c FROM public.admin_all_requests
              WHERE service_name IS NOT NULL AND service_name <> ''
              GROUP BY service_name) s), '[]'::jsonb),
    'sources', coalesce((
        SELECT jsonb_agg(jsonb_build_object('name', t.source_section, 'count', t.c) ORDER BY t.c DESC)
        FROM (SELECT source_section, count(*) c FROM public.admin_all_requests
              WHERE source_section IS NOT NULL AND source_section <> ''
              GROUP BY source_section) t), '[]'::jsonb),
    'statuses', coalesce((
        SELECT jsonb_agg(jsonb_build_object('name', u.status, 'count', u.c) ORDER BY u.c DESC)
        FROM (SELECT status, count(*) c FROM public.admin_all_requests
              WHERE status IS NOT NULL GROUP BY status) u), '[]'::jsonb),
    'date_min', (SELECT min(created_at) FROM public.admin_all_requests),
    'date_max', (SELECT max(created_at) FROM public.admin_all_requests)
  );
END $$;

-- ============================================================================
-- 7. REALTIME FOR ADMINS on the EXISTING request tables
--    (adds an admin-only SELECT policy + publication membership;
--     existing policies and the anon INSERT path are untouched)
-- ============================================================================
DO $$
DECLARE
  v_tbl text;
  v_policy text;
BEGIN
  FOREACH v_tbl IN ARRAY ARRAY['service_requests','contact_requests','callback_requests'] LOOP
    v_policy := 'admin_read_' || v_tbl;
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname='public' AND tablename=v_tbl AND policyname=v_policy) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
                        USING (public.is_current_admin())', v_policy, v_tbl);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=v_tbl) THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_tbl);
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'realtime: could not add % to publication (%) — polling fallback will be used', v_tbl, SQLERRM;
      END;
    END IF;
    BEGIN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', v_tbl);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- 8. WEBSITE SESSIONS READ-MODEL (existing table, existing logic preserved)
-- ============================================================================
DROP VIEW IF EXISTS public.admin_website_sessions;
CREATE VIEW public.admin_website_sessions
WITH (security_invoker = true)
AS
SELECT
  COALESCE(x.d->>'session_id', x.d->>'id')                                  AS session_id,
  COALESCE(x.d->>'created_at', x.d->>'started_at')::timestamptz             AS created_at,
  COALESCE(x.d->>'last_seen', x.d->>'last_seen_at', x.d->>'updated_at')::timestamptz AS last_seen,
  COALESCE(x.d->>'expires_at', x.d->>'expiry')::timestamptz                 AS expires_at,
  COALESCE(x.d->>'ip_hash', x.d->>'iphash')                                 AS ip_hash,
  COALESCE(x.d->>'user_agent', x.d->>'ua')                                  AS user_agent,
  COALESCE(x.d->>'referrer', x.d->>'referer')                               AS referrer,
  CASE
    WHEN COALESCE(x.d->>'expires_at', x.d->>'expiry')::timestamptz IS NOT NULL
      THEN COALESCE(x.d->>'expires_at', x.d->>'expiry')::timestamptz > now()
    ELSE COALESCE(x.d->>'last_seen', x.d->>'last_seen_at', x.d->>'updated_at',
                  x.d->>'created_at', x.d->>'started_at')::timestamptz
         > now() - interval '30 minutes'
  END                                                                       AS is_active
FROM public.website_sessions s
CROSS JOIN LATERAL (SELECT to_jsonb(s) AS d) x;

REVOKE ALL ON PUBLIC.admin_website_sessions FROM PUBLIC;
REVOKE ALL ON PUBLIC.admin_website_sessions FROM anon;
REVOKE ALL ON PUBLIC.admin_website_sessions FROM authenticated;
GRANT  SELECT ON PUBLIC.admin_website_sessions TO service_role;

CREATE OR REPLACE FUNCTION public.admin_session_stats()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.admin_can('view_sessions') THEN
    RAISE EXCEPTION 'insufficient_permission' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'total',   count(*),
    'active',  count(*) FILTER (WHERE is_active),
    'today',   count(*) FILTER (WHERE created_at::date = current_date),
    'last7',   count(*) FILTER (WHERE created_at >= now() - interval '7 days'),
    'last30',  count(*) FILTER (WHERE created_at >= now() - interval '30 days')
  ) INTO v
  FROM public.admin_website_sessions;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_sessions(
  p_active_only boolean DEFAULT NULL,
  p_search      text    DEFAULT NULL,
  p_page        int     DEFAULT 1,
  p_page_size   int     DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_page int := greatest(1, coalesce(p_page,1));
  v_size int := least(100, greatest(1, coalesce(p_page_size,20)));
  v_search text := nullif(btrim(coalesce(p_search,'')),'');
  v_result jsonb;
BEGIN
  IF NOT public.admin_can('view_sessions') THEN
    RAISE EXCEPTION 'insufficient_permission' USING ERRCODE = '42501';
  END IF;

  WITH filtered AS (
    SELECT s.session_id, s.created_at, s.last_seen, s.expires_at, s.is_active,
           s.ip_hash, left(coalesce(s.user_agent,''), 160) AS user_agent, s.referrer
    FROM public.admin_website_sessions s
    WHERE (p_active_only IS NULL OR s.is_active = p_active_only)
      AND (v_search IS NULL OR (
            coalesce(s.session_id,'') ILIKE '%'||v_search||'%'
         OR coalesce(s.ip_hash,'')    ILIKE '%'||v_search||'%'
         OR coalesce(s.user_agent,'') ILIKE '%'||v_search||'%'))
  )
  SELECT jsonb_build_object(
    'total',     (SELECT count(*) FROM filtered),
    'page',      v_page,
    'page_size', v_size,
    'pages',     greatest(1, ceiling((SELECT count(*) FROM filtered)::numeric / v_size)::int),
    'rows',      coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM (
                    SELECT f.* FROM filtered f
                    ORDER BY coalesce(f.last_seen, f.created_at) DESC NULLS LAST
                    LIMIT v_size OFFSET (v_page-1)*v_size) r), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END $$;

-- ============================================================================
-- 9. DASHBOARD + ANALYTICS  (100% real data from the existing tables)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_dashboard_data()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_req jsonb; v_sess jsonb; v_blocked jsonb;
  v_recent jsonb; v_trend jsonb; v_services jsonb;
  v_blocked_recent jsonb; v_audit jsonb; v_admins jsonb;
BEGIN
  IF NOT public.admin_can('view_requests') THEN
    RAISE EXCEPTION 'insufficient_permission' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'total',     count(*),
    'service',   count(*) FILTER (WHERE request_type='service'),
    'contact',   count(*) FILTER (WHERE request_type='contact'),
    'callback',  count(*) FILTER (WHERE request_type='callback'),
    'pending',   count(*) FILTER (WHERE status='pending'),
    'completed', count(*) FILTER (WHERE status='completed'),
    'cancelled', count(*) FILTER (WHERE status='cancelled'),
    'today',     count(*) FILTER (WHERE created_at::date = current_date),
    'last7',     count(*) FILTER (WHERE created_at >= now() - interval '7 days'),
    'last30',    count(*) FILTER (WHERE created_at >= now() - interval '30 days')
  ) INTO v_req
  FROM public.admin_all_requests;

  SELECT jsonb_build_object(
    'total',  count(*),
    'active', count(*) FILTER (WHERE is_active),
    'today',  count(*) FILTER (WHERE created_at::date = current_date),
    'last7',  count(*) FILTER (WHERE created_at >= now() - interval '7 days'),
    'last30', count(*) FILTER (WHERE created_at >= now() - interval '30 days')
  ) INTO v_sess
  FROM public.admin_website_sessions;

  SELECT jsonb_build_object(
    'active', count(*) FILTER (WHERE is_active AND (expires_at IS NULL OR expires_at > now())),
    'total',  count(*)
  ) INTO v_blocked
  FROM public.blocked_ips;

  SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) INTO v_recent
  FROM (SELECT request_type, request_id, name, email, phone, business_name,
               service_name, status, created_at
        FROM public.admin_all_requests
        ORDER BY created_at DESC NULLS LAST LIMIT 8) r;

  SELECT coalesce(jsonb_agg(jsonb_build_object('date', d::date::text,
                                               'count', coalesce(c.n,0)) ORDER BY d), '[]'::jsonb)
  INTO v_trend
  FROM generate_series(current_date - 13, current_date, interval '1 day') AS d
  LEFT JOIN (SELECT created_at::date AS day, count(*) AS n
             FROM public.admin_all_requests
             WHERE created_at >= (current_date - 13)::timestamptz
             GROUP BY 1) c ON c.day = d::date;

  SELECT coalesce(jsonb_agg(jsonb_build_object('service', s.service_name, 'count', s.c)
                            ORDER BY s.c DESC), '[]'::jsonb)
  INTO v_services
  FROM (SELECT service_name, count(*) c FROM public.admin_all_requests
        WHERE service_name IS NOT NULL AND service_name <> ''
        GROUP BY service_name ORDER BY c DESC LIMIT 8) s;

  SELECT coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb) INTO v_blocked_recent
  FROM (SELECT id, left(ip_hash, 12) AS ip_hash_prefix, label, reason, created_at, blocked_by_email
        FROM public.blocked_ips
        WHERE is_active AND (expires_at IS NULL OR expires_at > now())
        ORDER BY created_at DESC LIMIT 5) b;

  SELECT coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) INTO v_audit
  FROM (SELECT action, section, admin_email, record_id, created_at
        FROM public.admin_audit_logs
        ORDER BY created_at DESC, id DESC LIMIT 8) a;

  SELECT jsonb_build_object('total', count(*),
                            'active', count(*) FILTER (WHERE is_active))
  INTO v_admins
  FROM public.admin_profiles;

  RETURN jsonb_build_object(
    'requests',        v_req,
    'sessions',        v_sess,
    'blocked_ips',     v_blocked,
    'recent_requests', v_recent,
    'trend_14d',       v_trend,
    'by_service',      v_services,
    'recent_blocks',   v_blocked_recent,
    'recent_audit',    v_audit,
    'admins',          v_admins
  );
END $$;

CREATE OR REPLACE FUNCTION public.admin_analytics(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_days int := least(365, greatest(1, coalesce(p_days, 30)));
  v_totals jsonb; v_daily jsonb; v_by_service jsonb; v_by_source jsonb;
  v_sessions jsonb; v_sessions_daily jsonb; v_status jsonb;
BEGIN
  IF NOT public.admin_can('view_requests') THEN
    RAISE EXCEPTION 'insufficient_permission' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'total',     count(*),
    'service',   count(*) FILTER (WHERE request_type='service'),
    'contact',   count(*) FILTER (WHERE request_type='contact'),
    'callback',  count(*) FILTER (WHERE request_type='callback')
  ) INTO v_totals
  FROM public.admin_all_requests;

  SELECT jsonb_build_object(
    'pending',   count(*) FILTER (WHERE status='pending'),
    'completed', count(*) FILTER (WHERE status='completed'),
    'cancelled', count(*) FILTER (WHERE status='cancelled')
  ) INTO v_status
  FROM public.admin_all_requests;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'date',     d::date::text,
      'total',    coalesce(c.total,0),
      'service',  coalesce(c.service,0),
      'contact',  coalesce(c.contact,0),
      'callback', coalesce(c.callback,0)) ORDER BY d), '[]'::jsonb)
  INTO v_daily
  FROM generate_series(current_date - (v_days - 1), current_date, interval '1 day') AS d
  LEFT JOIN (
    SELECT created_at::date AS day,
           count(*) AS total,
           count(*) FILTER (WHERE request_type='service')  AS service,
           count(*) FILTER (WHERE request_type='contact')  AS contact,
           count(*) FILTER (WHERE request_type='callback') AS callback
    FROM public.admin_all_requests
    WHERE created_at >= (current_date - (v_days - 1))::timestamptz
    GROUP BY 1) c ON c.day = d::date;

  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.count DESC), '[]'::jsonb)
  INTO v_by_service
  FROM (SELECT service_name AS name,
               count(*) AS count,
               count(*) FILTER (WHERE status='pending')   AS pending,
               count(*) FILTER (WHERE status='completed') AS completed,
               count(*) FILTER (WHERE status='cancelled') AS cancelled
        FROM public.admin_all_requests
        WHERE service_name IS NOT NULL AND service_name <> ''
        GROUP BY service_name
        ORDER BY count DESC LIMIT 50) s;

  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.count DESC), '[]'::jsonb)
  INTO v_by_source
  FROM (SELECT source_section AS name, count(*) AS count
        FROM public.admin_all_requests
        WHERE source_section IS NOT NULL AND source_section <> ''
        GROUP BY source_section
        ORDER BY count DESC LIMIT 50) s;

  SELECT jsonb_build_object(
    'total',  count(*),
    'active', count(*) FILTER (WHERE is_active),
    'today',  count(*) FILTER (WHERE created_at::date = current_date),
    'last7',  count(*) FILTER (WHERE created_at >= now() - interval '7 days'),
    'last30', count(*) FILTER (WHERE created_at >= now() - interval '30 days')
  ) INTO v_sessions
  FROM public.admin_website_sessions;

  SELECT coalesce(jsonb_agg(jsonb_build_object('date', d::date::text,
                                               'count', coalesce(c.n,0)) ORDER BY d), '[]'::jsonb)
  INTO v_sessions_daily
  FROM generate_series(current_date - (v_days - 1), current_date, interval '1 day') AS d
  LEFT JOIN (SELECT created_at::date AS day, count(*) AS n
             FROM public.admin_website_sessions
             WHERE created_at >= (current_date - (v_days - 1))::timestamptz
             GROUP BY 1) c ON c.day = d::date;

  RETURN jsonb_build_object(
    'days',           v_days,
    'totals',         v_totals,
    'status',         v_status,
    'daily',          v_daily,
    'by_service',     v_by_service,
    'by_source',      v_by_source,
    'sessions',       v_sessions,
    'sessions_daily', v_sessions_daily
  );
END $$;

-- ============================================================================
-- 10. SESSION ME / OWN PROFILE / ADMIN LISTING
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_session_me(p_touch boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row public.admin_profiles; v_perms jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO v_row FROM public.admin_profiles WHERE id = auth.uid();
  IF v_row.id IS NULL OR NOT v_row.is_active THEN RETURN NULL; END IF;

  IF coalesce(p_touch, false) THEN
    UPDATE public.admin_profiles SET last_login_at = now() WHERE id = v_row.id;
  END IF;

  SELECT coalesce(jsonb_agg(perm), '[]'::jsonb) INTO v_perms
  FROM unnest(ARRAY['view_requests','update_status','delete_requests','export_data',
                    'view_settings','manage_settings','view_sessions',
                    'view_blocked_ips','manage_blocked_ips','view_audit',
                    'manage_admins']) AS perm
  WHERE public.admin_can(perm);

  RETURN jsonb_build_object(
    'id', v_row.id, 'email', v_row.email, 'full_name', v_row.full_name,
    'role', v_row.role, 'is_active', v_row.is_active,
    'can_delete_requests', v_row.can_delete_requests,
    'can_update_status', v_row.can_update_status,
    'last_login_at', v_row.last_login_at,
    'permissions', v_perms
  );
END $$;

CREATE OR REPLACE FUNCTION public.admin_update_own_profile(p_full_name text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_current_admin() THEN
    RAISE EXCEPTION 'insufficient_permission' USING ERRCODE = '42501';
  END IF;
  UPDATE public.admin_profiles
     SET full_name = nullif(btrim(coalesce(p_full_name,'')),''), updated_at = now()
   WHERE id = auth.uid();
  PERFORM public.admin_audit_internal('profile.update', 'settings', auth.uid()::text,
            jsonb_build_object('full_name', p_full_name));
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_admins()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.admin_can('manage_admins') THEN
    RAISE EXCEPTION 'insufficient_permission' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(to_jsonb(p) ORDER BY
             CASE p.role WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
             p.created_at)
    FROM (SELECT id, email, full_name, role, is_active, can_delete_requests,
                 can_update_status, last_login_at, created_at, updated_at
          FROM public.admin_profiles) p), '[]'::jsonb);
END $$;

-- ============================================================================
-- 11. FIRST SUPER ADMIN BOOTSTRAP
--     Works ONLY while no active super_admin exists. Executable from the
--     Supabase SQL Editor (as postgres) or via service_role. NOT callable by
--     anon/authenticated (revoked below).
--
--     Steps:
--       1) Supabase Dashboard → Authentication → Users → "Add user"
--          (enter the admin email + password, tick "Auto Confirm User").
--       2) In SQL Editor run:
--          SELECT public.bootstrap_first_super_admin('you@yourdomain.com');
-- ============================================================================
CREATE OR REPLACE FUNCTION public.bootstrap_first_super_admin(p_email text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.admin_profiles WHERE role='super_admin' AND is_active) THEN
    RAISE EXCEPTION 'bootstrap_locked: an active Super Admin already exists. Manage admins from the Admin Panel instead.'
      USING ERRCODE = '42501';
  END IF;

  SELECT u.id INTO v_uid FROM auth.users u WHERE lower(u.email) = lower(btrim(p_email));
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_user_not_found: create the user first in Supabase Dashboard → Authentication → Users → Add user (email: %)', p_email
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.admin_profiles (id, email, full_name, role, is_active, can_delete_requests, can_update_status)
  VALUES (v_uid, lower(btrim(p_email)), split_part(lower(btrim(p_email)), '@', 1),
          'super_admin', true, true, true)
  ON CONFLICT (id) DO UPDATE SET
    role = 'super_admin', is_active = true, email = EXCLUDED.email, updated_at = now();

  RETURN jsonb_build_object('ok', true, 'message', 'Super Admin created for ' || p_email, 'id', v_uid);
END $$;

-- ============================================================================
-- 12. GRANTS / REVOKES (least privilege)
-- ============================================================================
DO $$
DECLARE r record;
BEGIN
  -- All admin_* RPCs: executable by authenticated admins only (they also
  -- self-gate via admin_can/is_current_admin). Never exposed to anon.
  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'admin\_%'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.fn);
  END LOOP;

  -- Bootstrap: service_role + SQL editor (postgres) only.
  REVOKE EXECUTE ON FUNCTION public.bootstrap_first_super_admin(text) FROM PUBLIC, anon, authenticated;
  GRANT  EXECUTE ON FUNCTION public.bootstrap_first_super_admin(text) TO service_role;

  -- Public website-settings getter: readable by the main website (anon).
  GRANT EXECUTE ON FUNCTION public.get_website_settings() TO anon, authenticated, service_role;

  -- IP hashing helper (used by the panel's block flow).
  GRANT EXECUTE ON FUNCTION public.admin_hash_ip(text) TO authenticated, service_role;
  REVOKE EXECUTE ON FUNCTION public.admin_hash_ip(text) FROM PUBLIC, anon;
END $$;

COMMIT;

-- ============================================================================
-- DONE. Verify:
--   SELECT public.get_website_settings();            -- public config API
--   SELECT * FROM public.admin_profiles;             -- empty until bootstrap
--   SELECT tgname, tgrelid::regclass FROM pg_trigger
--    WHERE tgname = 'admin_block_ip_guard';          -- attached to 3 tables
-- Next: create the first Super Admin (section 11), then deploy the panel.
-- ============================================================================
