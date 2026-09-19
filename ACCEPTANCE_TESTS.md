# Acceptance Tests (spec §51) — How to verify each one

Database-level equivalents of tests 1–13, 15 and 16 were executed
automatically against a PostgreSQL 17 harness with a faithful mock of the
documented main-website schema: **51/51 assertions passed**. Below is how to
verify every test manually on your real system after deployment.

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 1 | Service request flows through | Submit the service form on `sddigitalhub.in` → open panel **Requests → Service Requests** | Row appears in the existing `service_requests` table AND in the panel within seconds (realtime) — same record, no copy |
| 2 | Contact request flows through | Submit the contact form → **Requests → Contact Requests** | Appears from `contact_requests` |
| 3 | Callback request flows through | Submit a callback request → **Requests → Callback Requests** | Appears from `callback_requests` |
| 4 | Status update | Open any request → click **Completed** | Supabase table row now has `status='completed'`, `updated_at` bumped; audit entry `request.status_changed` with old→new; dashboard counters move |
| 5 | Delete request | Row → trash icon → confirm dialog identifying the record → **Delete permanently** | Row gone from the existing table; audit entry `request.deleted` with a full JSON snapshot |
| 6 | Filters | Combine Status=Pending + Type=Callback + Last 30 days | Only matching records; count matches the same filters applied in SQL |
| 7 | Filtered CSV export | With filters from #6 active → **Export → CSV** | File contains exactly the filtered rows (compare count). “Export selected” after ticking rows exports only those |
| 8 | Change phone | **Website → Contact Information** → new phone → Save | Main website shows the new number after its settings refresh (≤60 s with the INTEGRATION.md snippet; immediately if fetched per-request) — no redeploy |
| 9 | Change email | Same page → new email → Save | Website mailto uses the new email |
| 10 | Change WhatsApp | Same page → new WhatsApp → Save | Website `wa.me` link uses the new number (preview shown under the form) |
| 11 | Change social link | **Website → Social Links** → edit/add/hide | Website renders the new set (hidden links excluded) |
| 12 | Block IP | **Security → Blocked IPs** → Block IP (use a hash copied from Sessions, or the raw IP if your hashing matches `admin_hash_ip`) → submit a request from that IP/network | Submission rejected; **zero new rows** in any request table; the visitor sees your generic error |
| 13 | Unblock IP | Unblock the same record → submit again | Accepted, subject to the existing 5/hour rate limit |
| 14 | Unauthenticated access | Open `https://admin.sddigitalhub.in/dashboard` in a private window | Redirected to `/login`; API routes answer 401; no data leaked |
| 15 | Super Admin creates Admin | **Administration → Admin Users → Add admin** (role Admin, grant delete flag) → sign in as the new admin | New admin sees requests; cannot open Admin Users / Blocked-IP management / settings editing; delete works only with the flag; Support role cannot export/delete |
| 16 | Dashboard accuracy | Compare each dashboard card with SQL: `select count(*) from service_requests;` etc. | Every number matches exactly — all counts come from one `admin_dashboard_data()` RPC over the existing tables |

## Extra checks worth running

- **Rate limit preserved**: submit 6 requests quickly from one network → the
  6th is rejected with your existing rate-limit message (the panel did not
  touch it).
- **Login lockout**: 8 wrong passwords → panel locks that email/IP for
  15 minutes (`admin_login_attempts`), on top of Supabase Auth's own limits.
- **Audit trail**: log in, change a status, block an IP, edit a setting →
  **Administration → Audit Logs** shows all of them with actor + timestamps;
  no passwords anywhere.
- **Main website regression (§50)**: homepage, services, all three forms,
  session tracking, SEO output — all behave exactly as before the migration
  (it only adds objects; verified by rollback test leaving 4 tables + 2 RPCs +
  all rows intact).
- **Mobile**: open the panel on a phone → drawer navigation, cards and
  horizontally scrollable tables.
