# SD Digital Hub — Admin Control Panel

A **separate, dedicated admin application** for `sddigitalhub.in`, built on the
**SAME Supabase project** as the main website. One database. One source of
truth. Zero duplicate request tables. Zero manual sync.

```
                 CUSTOMER
                    |
                    v
          +-------------------+
          |   MAIN WEBSITE    |   sddigitalhub.in
          +---------+---------+
                    |  submit_website_request / touch_website_session
                    v
          +-------------------+
          |     SUPABASE      |   ONE project
          |  service_requests |   (existing tables — untouched)
          |  contact_requests |
          |  callback_requests|
          |  website_sessions |
          |  + admin tables   |   (added by sql/01_admin_migration.sql)
          +---------+---------+
                    |  RLS + SECURITY DEFINER RPCs
                    v
          +-------------------+
          |   ADMIN PANEL     |   admin.sddigitalhub.in (this app)
          |  Dashboard        |
          |  Requests         |
          |  Analytics        |
          |  Sessions         |
          |  Security         |
          |  Admin Management |
          +-------------------+
```

## What this is / is not

| ✅ It is | ❌ It is not |
|---|---|
| A separate Next.js app you deploy on its own (sub)domain | A copy of the public website |
| Reads/writes the EXISTING request tables directly | A second database or duplicate tables (`admin_*_requests` etc. do NOT exist) |
| Role-based, database-enforced permissions | A UI that only hides buttons |
| Real data only — every number comes from Supabase | A mockup with dummy data |
| A limited settings system (business/contact/social) | A CMS / page builder |
| Additive SQL migration (existing SQL untouched) | A replacement of your main-website SQL |

## Verification status

- `npm run build` — **green** (TypeScript strict, production build).
- `sql/01_admin_migration.sql` — verified on PostgreSQL 17 against a faithful
  mock of the documented main-website schema: **51/51 assertions passed**,
  including blocked-IP rejection *before* insertion, preservation of the
  existing 5-requests/hour rate limit, the full role/permission matrix,
  filtered exports, settings propagation, realtime readiness and idempotent
  re-runs. `sql/99_rollback_admin.sql` verified to leave the original schema
  and all customer rows untouched.

---

## Setup (follow this exact order — spec §46)

### 1. Run your existing main-website SQL
Already done in your production project — nothing to repeat. The migration
**aborts with a clear error** if the four existing tables are missing.

### 2. Inspect the existing database (read-only, safe)
Supabase Dashboard → **SQL Editor** → paste & run:

```
sql/00_inspect_existing_schema.sql
```

Skim the output (columns, enums, `submit_website_request`, ip-hash column
names). The migration adapts automatically, but 2 minutes here avoids
surprises.

### 3. Run the Admin Panel migration
Same SQL Editor → paste & run:

```
sql/01_admin_migration.sql
```

It is **idempotent** (safe to re-run) and creates ONLY new structures:
`admin_profiles`, `admin_audit_logs`, `admin_login_attempts`,
`website_settings`, `social_links`, `blocked_ips`, read-model views, gated
RPCs, the blocked-IP guard trigger, and admin realtime policies.

Watch for `NOTICE: block-guard: attached to ... (column: ip_hash)` — that
confirms the blocked-IP trigger found your real ip-hash column on all three
request tables.

### 4. Configure environment
Copy `.env.example` → `.env.local` (local) or set the same vars in Vercel:

| Variable | Where from | Exposure |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL | Browser (public by design) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → `anon` `public` key | Browser (safe — RLS enforces everything) |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` (secret) | **Server only.** Used solely by `/api/admins*` + `/api/bootstrap` + login rate-limiting. Never `NEXT_PUBLIC_`. |
| `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` *(optional)* | you | Enables headless first-Super-Admin bootstrap |

Same project as the main website — **do not create a second Supabase project.**

### 5. Create the first Super Admin (securely)

**Option A — SQL (recommended):**
1. Supabase Dashboard → **Authentication → Users → Add user** → enter the
   admin's email + password → tick **Auto Confirm User**.
2. SQL Editor → run:
   ```sql
   SELECT public.bootstrap_first_super_admin('you@yourdomain.com');
   ```
   Works only while no active Super Admin exists, then locks itself.

**Option B — headless API** (if `ADMIN_BOOTSTRAP_EMAIL` is set on the server):
```bash
curl -X POST https://admin.sddigitalhub.in/api/bootstrap \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@yourdomain.com","password":"<same-as-env>"}'
```
Then **remove the two bootstrap env vars** and redeploy.

After that, Super Admins create further admins from **Administration → Admin
Users** — no Supabase Dashboard needed.

### 6. Deploy
See **[DEPLOYMENT.md](DEPLOYMENT.md)** (Vercel + `admin.sddigitalhub.in` DNS +
Supabase auth URL config).

### 7. Wire the main website to the settings API (one-time, small)
See **[INTEGRATION.md](INTEGRATION.md)** — required for acceptance tests 8–11
(phone/email/WhatsApp/social changes reflecting on the website without a
redeploy).

---

## Roles & permissions (enforced IN THE DATABASE)

| Capability | Super Admin | Admin | Support |
|---|:-:|:-:|:-:|
| View requests / dashboard / analytics / sessions | ✅ | ✅ | ✅ |
| Update request status | ✅ | ✅ | ⚙️ if `can_update_status` |
| Delete requests | ✅ | ⚙️ if `can_delete_requests` | ❌ |
| Export CSV/XLSX/XML/PDF | ✅ | ✅ | ❌ |
| View website info | ✅ | ✅ (read-only) | ❌ |
| Manage settings & social links | ✅ | ❌ | ❌ |
| View / manage blocked IPs | ✅ / ✅ | ✅ / ❌ | ❌ |
| View audit logs | ✅ | ✅ | ❌ |
| Manage admin accounts | ✅ | ❌ | ❌ |

Every admin RPC calls `admin_can(...)` first and raises `42501` otherwise —
hiding a button in the UI changes nothing about what the database allows.

## Feature map (spec → implementation)

- **Dashboard** (§9, §41): live counts for all 9 cards, 14-day trend, recent
  requests, top services, sessions, security alerts, recent admin activity.
- **Requests** (§10–§15): All / Service / Contact / Callback views over the
  existing tables; full detail page with *all stored fields*, Call / WhatsApp /
  Email shortcuts; **no customer-data edit form anywhere**.
- **Status** (§16): `pending/completed/cancelled` written to the existing
  record (enum-aware).
- **Delete** (§17): confirmation dialog identifying the record; snapshot kept
  in the audit log; permission-gated.
- **Search** (§18), **Filters** (§19: status/type/date presets/custom/service/
  source), **Sorting** (§20), **Pagination** (§21: 20/50/100) — all executed
  inside Postgres, page by page.
- **Export** (§22–§24): CSV, Excel (.xlsx), XML, PDF from any section;
  respects active filters; “Export selected” for checked rows. No `.exe` —
  data formats only.
- **Bulk actions** (§25): mark pending/completed/cancelled, export selected,
  delete selected (typed `DELETE` confirmation).
- **Realtime** (§26): Supabase Realtime subscriptions on the three existing
  tables (admin-only SELECT policies added) + 60 s polling fallback.
- **Rate limit** (§27): untouched — verified by test that the 6th request in
  an hour is still rejected.
- **Blocked IPs** (§28–§30): Super-Admin managed; hash-only storage; enforced
  by a `BEFORE INSERT` trigger on the existing tables, so blocked submissions
  are rejected **before** any row exists; unblock restores normal behavior.
- **Sessions** (§31): stats + table from the existing `website_sessions`;
  hashed identifiers only.
- **Website settings** (§32–§36): business info, contact info, social links —
  a limited system, not a CMS; public RPC `get_website_settings()` lets the
  main website auto-update (§35).
- **SEO** (§37): untouched — the panel never writes to your SEO system.
- **Analytics** (§38) and **Audit log** (§39): DB-backed, paginated, filterable.
- **UI/Responsive/Error handling** (§40–§43): professional dashboard shell,
  mobile drawer, loading skeletons, toasts, empty states, retries, friendly
  error messages (raw DB errors are logged server-side, never shown).
- **Security** (§44–§47): RLS everywhere, no service-role key in the browser,
  no public request-data endpoints, env-var configuration.

## Project structure

```
sd-admin-panel/
├── sql/
│   ├── 00_inspect_existing_schema.sql   # read-only inspection (run first)
│   ├── 01_admin_migration.sql           # ONLY new admin structures (idempotent)
│   └── 99_rollback_admin.sql            # optional clean removal
├── src/
│   ├── middleware.ts                    # session refresh + route protection
│   ├── actions/                         # server actions (auth, requests, settings, social, security, profile)
│   ├── app/
│   │   ├── login/                       # Supabase Auth sign-in + rate limiting
│   │   ├── (admin)/                     # protected shell (sidebar/topbar)
│   │   │   ├── dashboard/  requests/  analytics/  sessions/
│   │   │   ├── website/{business,contact,social}/
│   │   │   ├── security/blocked-ips/
│   │   │   ├── administration/{admins,audit}/
│   │   │   └── settings/
│   │   └── api/
│   │       ├── export/                  # CSV/XLSX/XML/PDF (filtered, selected)
│   │       ├── admins/…                 # service-role admin management (server-only)
│   │       └── bootstrap/               # optional first-Super-Admin bootstrap
│   ├── components/                      # UI kit, charts, feature components
│   └── lib/                             # env, supabase clients, guards, queries, exports
├── README.md  DEPLOYMENT.md  INTEGRATION.md  ACCEPTANCE_TESTS.md
└── .env.example
```

## Local development

```bash
cp .env.example .env.local   # fill in your project values
npm install
npm run dev                  # http://localhost:3000
```

The app refuses to render dashboards with fake data: if env vars are missing
it shows a configuration screen instead.

## Security notes

- The **service-role key exists only on the server** (`/api/*` route handlers).
  No client bundle contains it (it is not `NEXT_PUBLIC_`).
- No admin passwords are hardcoded anywhere; authentication is Supabase Auth
  (bcrypt-hashed by GoTrue) in the same project.
- Login is rate-limited twice: Supabase Auth's own limits **plus** the panel's
  `admin_login_attempts` lockout (8 failures / 15 min per email+IP hash).
- Raw IP addresses are never stored — only SHA-256 hashes.
- The panel is `noindex`/`nofollow`, sends `X-Frame-Options: DENY` and related
  headers, and every privileged RPC is `SECURITY DEFINER` with an explicit
  permission gate.
