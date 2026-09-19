# Deployment Guide — admin.sddigitalhub.in (Vercel)

The Admin Panel deploys **independently** from the main website. Both point at
the **same Supabase project**.

## 1. Push the code to GitHub

```bash
cd sd-admin-panel
git init && git add -A && git commit -m "SD Digital Hub Admin Panel v1.0.0"
git remote add origin git@github.com:<you>/sd-admin-panel.git
git push -u origin main
```

> `.gitignore` already excludes `.env*` — double-check `git status` shows no
> env file before pushing. **Never commit the service-role key.**

## 2. Create the Vercel project

1. vercel.com → **Add New… → Project** → import `sd-admin-panel`.
2. Framework preset: **Next.js** (auto-detected). Build command `next build`,
   output `.next` — leave defaults.
3. Before deploying, open **Settings → Environment Variables** and add:

| Name | Value | Environment |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<your-project-ref>.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon **public** key | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role **secret** key | Production (+Preview if you use it) |

All three come from **Supabase Dashboard → Project Settings → API** of your
EXISTING project. Optionally add `NEXT_PUBLIC_MAIN_SITE_URL=https://sddigitalhub.in`.

4. **Deploy.** First build takes ~1–2 minutes.

## 3. Attach the domain admin.sddigitalhub.in

1. Vercel project → **Settings → Domains → Add** → `admin.sddigitalhub.in`.
2. In your DNS provider (wherever `sddigitalhub.in` is managed), create:

   | Type | Name | Value |
   |---|---|---|
   | CNAME | `admin` | `cname.vercel-dns.com` |

   (or A record `@admin` → `76.76.21.21` if your provider doesn't support CNAME on that label)
3. Wait for Vercel to show **Valid Configuration** and issue the TLS cert.
4. Keep the main website exactly where it is — nothing about `sddigitalhub.in`
   changes.

## 4. Supabase auth configuration for the new URL

Supabase Dashboard → **Authentication → URL Configuration**:

- **Site URL**: your main site can stay as-is; the admin panel uses cookie
  auth on its own domain.
- **Redirect URLs**: add
  ```
  https://admin.sddigitalhub.in/**
  ```
  (and `http://localhost:3000/**` for local development).

No new auth providers, no second auth system — admins sign in with
email/password against the same GoTrue instance.

## 5. Database (once, before first login)

In the SQL Editor of the same project:

1. `sql/00_inspect_existing_schema.sql` — read-only sanity check.
2. `sql/01_admin_migration.sql` — additive migration (idempotent).
3. First Super Admin:
   - **Authentication → Users → Add user** (email + password, Auto Confirm), then
   - `SELECT public.bootstrap_first_super_admin('you@yourdomain.com');`

Details in README §Setup.

## 6. Post-deploy checklist

- [ ] `https://admin.sddigitalhub.in` shows the sign-in page (not the main site).
- [ ] Visiting any panel route signed-out redirects to `/login` (Test 14).
- [ ] Super Admin can sign in and the Dashboard shows real counts (Test 16).
- [ ] Submit a test request on the main website → it appears in the panel
      within seconds without refreshing (Realtime) (Tests 1–3).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set (Settings page → “Server admin API:
      configured”) — required for Admin Users management.
- [ ] Optional bootstrap env vars removed after first Super Admin creation.
- [ ] Main website still works end-to-end (Test §50 checklist in
      ACCEPTANCE_TESTS.md).

## Rollback / redeploy notes

- Panel redeployments never touch the database.
- To remove the panel completely: delete the Vercel project + DNS record and
  (optionally) run `sql/99_rollback_admin.sql` — verified to leave all
  existing tables, functions, policies and customer rows untouched.

## Scaling & limits

- Vercel Hobby plan is sufficient; all heavy lifting (search, filtering,
  aggregation) happens in Postgres via indexed RPCs.
- Export routes cap at 100,000 rows per file and stream a buffer response —
  within serverless limits for realistic business volumes.
