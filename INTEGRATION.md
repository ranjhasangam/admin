# Main-Website Integration Guide

Small, surgical wiring so the EXISTING main website benefits from the Admin
Panel without being rebuilt. Nothing here replaces your SEO system, forms,
session tracking or `submit_website_request` / `touch_website_session`.

There are exactly **three** integration points:

---

## 1. Website settings auto-update (required for acceptance tests 8–11)

The Admin Panel writes business/contact/social data to `website_settings` +
`social_links` in your existing Supabase project. The database exposes one
public read-only RPC:

```sql
SELECT public.get_website_settings();
```

```jsonc
{
  "settings": {
    "business_name": "SD Digital Hub",
    "business_description": "…",
    "phone": "+91 …",
    "email": "contact@sddigitalhub.in",
    "whatsapp": "+91 …",
    "address": "…", "city": "Patna", "state": "Bihar",
    "pincode": "…", "country": "India"
  },
  "social_links": [
    { "id": "…", "platform": "instagram", "url": "https://instagram.com/…", "label": "Instagram", "sort_order": 1 }
  ],
  "updated_at": "2026-09-19T06:00:00Z"
}
```

No auth needed; it only returns public values (never secrets, never hidden
links).

### Snippet A — plain JS website (works with your existing Supabase client)

```js
// settings.js — load once on page load; falls back to your current hardcoded values
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY); // the keys you already use

export async function loadSiteSettings(fallback = {}) {
  try {
    const { data, error } = await supabase.rpc("get_website_settings");
    if (error || !data) return fallback;
    return { ...fallback, ...data.settings, social_links: data.social_links };
  } catch {
    return fallback; // offline / misconfig → website keeps working with old values
  }
}

// usage
const s = await loadSiteSettings({ phone: "+91 00000 00000" /* current values */ });
document.querySelector("[data-phone]").textContent = s.phone;
document.querySelector("a[data-phone-link]").href = "tel:" + s.phone;
document.querySelector("a[data-whatsapp]").href =
  "https://wa.me/" + (s.whatsapp || "").replace(/\D/g, "");
document.querySelector("a[data-email]").href = "mailto:" + s.email;
document.querySelector("[data-address]").textContent =
  [s.address, s.city, s.state, s.pincode].filter(Boolean).join(", ");

// social icons
const icons = document.querySelector("#social-links");
icons.innerHTML = "";
(s.social_links || []).forEach((l) => {
  const a = document.createElement("a");
  a.href = l.url; a.target = "_blank"; a.rel = "noreferrer";
  a.dataset.platform = l.platform; a.title = l.label || l.platform;
  a.textContent = l.label || l.platform;
  icons.appendChild(a);
});
```

### Snippet B — Next.js/React website (server-rendered, cached 60 s)

```tsx
// lib/site-settings.ts  (server only)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,
                              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function getSiteSettings() {
  const { data } = await supabase.rpc("get_website_settings");
  return data ?? { settings: {}, social_links: [] };
}

// app/layout.tsx (or wherever the header/footer render)
export const revalidate = 60; // pick up admin changes within a minute, no redeploy
const { settings, social_links } = await getSiteSettings();
<a href={`tel:${settings.phone}`}>{settings.phone}</a>
```

> Keep your existing hardcoded values as **fallbacks** so the website still
> works even if Supabase is briefly unreachable. That's the whole change —
> after it, admin edits to phone/email/WhatsApp/address/social links appear
> on the website automatically (spec §35).

---

## 2. Blocked-IP behavior (automatic — nothing to code)

The migration attached a `BEFORE INSERT` trigger (`admin_block_ip_guard`) to
your three existing request tables. When a blocked visitor submits:

- `submit_website_request` raises a Postgres error (`REQUEST_BLOCKED_IP`,
  SQLSTATE 42501) and **no row is inserted**;
- your existing frontend error handling shows its generic failure message —
  recommended, so blockers learn nothing;
- the existing 5-per-hour rate limit is untouched and keeps working for
  everyone else.

If you want a friendlier message, map the error text in your submit handler:

```js
const { error } = await supabase.rpc("submit_website_request", { … });
if (error?.message?.includes("REQUEST_BLOCKED_IP")) {
  show("We couldn't process your request. Please contact support.");
}
```

### IP-hash compatibility (one function)

The guard compares the value in your request tables' ip-hash column against
hashes created by:

```sql
public.admin_hash_ip(p_ip text)  -- default: sha256 hex of the trimmed IP
```

If your main website computes the hash differently (salt, md5, app-side
hashing), **redefine only this one function** to produce identical values —
everything else (UI, RPCs, trigger) follows automatically. To verify:

```sql
-- must match the values stored in your request tables for the same IP:
SELECT public.admin_hash_ip('<an ip you logged>');
SELECT ip_hash FROM public.website_sessions ORDER BY last_seen DESC LIMIT 5;
```

You can also block by pasting an existing hash copied from the panel's
**Website Sessions** page — guaranteed to match whatever produced it.

---

## 3. Realtime (optional, zero-code)

The migration added admin-only SELECT policies and realtime publication for
the three request tables. This does **not** expose data to the public: the
policies evaluate `is_current_admin()` against the viewer's JWT, and your
existing anon policies are unchanged. The Admin Panel subscribes to inserts/
updates/deletes and refreshes automatically; a 60-second poll runs as a
fallback. Your website needs no changes for realtime.

---

## What is NOT touched

- Your SEO system/pages — the panel never reads or writes them (spec §37).
- `submit_website_request`, `touch_website_session`, the status enum, the
  rate-limit logic, existing RLS policies, existing tables/columns.
- Your frontend framework/stack — the snippets above are additive.
