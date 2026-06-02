# Changelog

## 2026-06-02 (Run 2) — Auth Layer Audit: Public Endpoint Security

### Security Fixes

**BUG-BRIGID-11 (MEDIUM) — Whitespace-only password bypasses length check in `POST /api/auth/pt-signup`**
`password.length < 8` passed for a string of 8 space characters (e.g. `'        '`),
allowing a functionally empty password through to Supabase's auth system.
Fix: changed to `password.trim().length < 8`; also added `typeof password !== 'string'`
type guard.

**BUG-BRIGID-12 (LOW) — No maximum length on `full_name` in `POST /api/auth/pt-signup`**
Strings of 5 000+ characters were accepted without a server-side cap and stored in
both `user_metadata` and the `profiles` table. Fix: return HTTP 400 if `full_name`
exceeds 255 characters.

**BUG-BRIGID-13 (MEDIUM) — Unauthenticated callers could trigger platform invite emails to arbitrary addresses via `POST /api/auth/resend-invite`**
The route called `admin.auth.admin.inviteUserByEmail(email)` without first confirming
the email belonged to an existing user, allowing any unauthenticated request to send a
Brigid invite email to any well-formed address.
Fix: query `profiles` first; only call `inviteUserByEmail` when a matching profile
exists. Unknown emails receive a generic `{ ok: true }` (user-enumeration prevention).

### Housekeeping

- `app/layout.tsx` — moved `themeColor` from `metadata` to `viewport` export per
  Next.js 15 API; eliminates deprecation warning on every server render.
- Added `scripts/cleanup-audit-accounts.ts` — removes ephemeral PT accounts created
  during automated audit runs when `TURNSTILE_SECRET_KEY` is absent in dev.

### Audit Findings — No Fix Required

- All 9 protected API endpoints return 401/403 for unauthenticated requests ✅
- XSS/SQL/type-coercion payloads all blocked at auth gate before deserialization ✅
- No `dangerouslySetInnerHTML` in codebase — stored HTML tags cannot execute ✅
- `escapeHtml()` applied to all email template interpolations ✅
- Type coercion attacks (array/bool/number in typed fields) rejected by Supabase ✅

---

## 2026-06-02 — Automated Data Boundary, Robustness & Injection Audit

### Deployment Fix

**DEPLOY-001 (CRITICAL) — Stripe lazy-init crash blocked Phase 2 deployment (`e1d178e`)**
`lib/stripe.ts` called `new Stripe(process.env.STRIPE_SECRET_KEY!)` at module scope.
During Next.js "Collecting page data" the key is `undefined`, throwing
`"Neither apiKey nor config.authenticator provided"` and killing the build entirely.
Phase 2 features (programmes, bug reports, billing, cron jobs) were never live.
Fix: replaced with a `getStripe()` lazy getter; all callers updated.

### Bug Fixes

**BUG-001 (MEDIUM) — `PATCH /api/agreements` invalid status → raw Postgres 500 (`b1124aa`)**
Passing an unrecognised `status` string hit the Postgres enum constraint and returned a
raw 500 `"invalid input value for enum agreement_status"`. Added explicit allow-list
validation before the DB call; now returns 400 with a human-readable message.

**BUG-002 (MEDIUM) — `PATCH /api/agreements` type mismatch → raw Postgres 500 (`b1124aa`)**
Passing a non-numeric string for `program_length_weeks` returned a raw 500
`"invalid input syntax for type integer"`. Fixed by coercing with `Number()` and
rejecting non-integers with 400 before the DB write.

**BUG-003 (LOW-MEDIUM) — `PATCH /api/agreements` no bounds on `program_length_weeks` (`b1124aa`)**
The PATCH handler had no range validation; values like 0 and 99999 were silently stored.
Now enforces the same 1–260 rule as `POST /api/clients`.

**BUG-004 (MEDIUM) — `PATCH /api/agreements` non-existent ID → raw PostgREST 500 (`b1124aa`)**
Updating a non-existent or non-owned agreement returned PostgREST's internal
`"Cannot coerce the result to a single JSON object"` 500. Now maps PGRST116 to
404 "Agreement not found".

**BUG-005 (LOW-MEDIUM) — `POST /api/templates` orphan template on bad exercise_id (`b1124aa`)**
When `session_template_items` insert failed (FK violation on `exercise_id`), the template
header row was left in the database with no items. Now the header is deleted in the
error path before returning. FK violations (code 23503) now return 400
`"One or more exercise IDs are invalid"` instead of leaking the constraint name.
Also corrected success response to 201.

**BUG-006 (LOW) — `POST /api/clients` `program_length_weeks = 0` bypassed validation (`b1124aa`)**
`program_length_weeks ? parseInt(...)` treated `0` as falsy, silently converting it to
`null` and skipping the 1–260 bounds check. Changed to `program_length_weeks != null`.

### Audit Findings — No Fix Required

- SQL injection (all endpoints) — Supabase ORM uses parameterized queries; payloads
  stored as literal strings, never executed ✅
- XSS in text fields (`billing_notes`, exercise names, template titles) — React JSX
  auto-escapes all interpolations; payloads cannot execute in the UI ✅
- Doc URL protocol validation (`javascript:`, `data:`, `ftp:`) — all correctly blocked
  by existing `new URL()` + protocol allow-list in `/api/client/docs` ✅
- Session DELETE IDOR — returns 404 for non-owned sessions ✅
- Agreement PATCH field injection (`pt_id`, `client_id` in body) — field whitelist
  correctly strips unrecognised keys ✅
- Auth on all tested endpoints — 401/403 returned correctly ✅

### Validation Rules Reference

| Field | Endpoint | Rule |
|-------|----------|------|
| `program_length_weeks` | POST /api/clients, PATCH /api/agreements | Integer 1–260 or null |
| `status` | PATCH /api/agreements | `active` \| `attention` \| `paused` \| `inactive` |
| `agreement_model` | POST /api/clients, PATCH /api/agreements | `subscription` \| `fixed_block` \| `hybrid` |
| `category` | POST /api/exercises | `healing` \| `forging` \| `verse` |
| `*_storage_url` | PATCH /api/client/docs | `http:` or `https:` only |

---

## 2026-06-01 — Security Audit: Input Validation & Injection Hardening

### Security Fixes

**BUG-1 (MEDIUM) — HTML Injection in Email Templates**
User-controlled strings were interpolated directly into HTML email bodies without escaping, enabling HTML injection via crafted names, session titles, or bug report notes.
- Added `escapeHtml()` utility to `lib/utils.ts`
- Applied to all three email-building functions:
  - `app/api/bug-reports/route.ts` — admin alert email (`notes`, `url`, `pageTitle`, `userEmail`, `label`)
  - `app/api/sessions/[id]/complete/route.ts` — PT completion alert (`ptFirstName`, `clientName`, `sessionTitle`, `date`)
  - `app/api/bug-reports/[id]/route.ts` — reporter resolution email (`firstName`, `label`, `pageTitle`, `resolvedNote`)

**BUG-2 (MEDIUM) — Unhandled RangeError in Programme Assignment**
An invalid `startDate` value (e.g. `"not-a-date"`) caused `new Date().toISOString()` to throw an unhandled `RangeError`, returning a 500 instead of a 400.
- `app/api/programmes/[id]/assign/route.ts` — added `isNaN(parsedMonday.getTime())` guard before the session creation loop; returns HTTP 400 with a descriptive message

**BUG-3 (LOW) — Missing Enum Validation Returns 500**
Invalid `agreement_model` or `category` values bypassed API validation and hit Postgres enum constraints, returning opaque 500 errors instead of client-friendly 400s.
- `app/api/clients/route.ts` — validates `agreement_model` against `['subscription', 'fixed_block', 'hybrid']`; also added bounds check on `program_length_weeks` (1–260 weeks)
- `app/api/exercises/route.ts` — validates `category` against `['healing', 'forging', 'verse']`

**BUG-4/XSS (MEDIUM) — `javascript:` URIs Accepted in Client Document URL Fields**
The `PATCH /api/client/docs` endpoint accepted any string for `parq_storage_url`, `waiver_storage_url`, and `consent_storage_url`. These are rendered as `<a href>` links in the PT dashboard; a malicious client could submit `javascript:alert(...)` to execute arbitrary code in the PT's browser when they click the link.
- `app/api/client/docs/route.ts` — validates each URL with `new URL()` and rejects anything with a protocol other than `http:` or `https:`

### Passed (No Issues Found)

- SQL Injection — all queries use Supabase ORM parameterized calls ✅
- Authentication bypass — all endpoints call `getUser()` before acting ✅
- CSRF — Supabase JWT cookie auth provides CSRF protection ✅
- Path traversal in file uploads — paths use UUIDs from auth ✅
- Inactivity token — HMAC-SHA256 with `timingSafeEqual`, 7-day TTL ✅
- SVG upload XSS — SVGs served via `<img>` tag; browsers don't execute scripts in this context ✅
- Rate limiting on PT signup — Cloudflare Turnstile gate present ✅

### Fringe Data Observations (No Fix Required — Acceptable Behaviour)

- Unbounded `text` fields (`notes`, `billing_notes`, `coaching_cues`) — Postgres `text` type is unlimited; no business constraint warrants a cap
- Extreme valid dates (`1900-01-01`, `9999-12-31`) — Postgres `date` handles these correctly; no application logic depends on sane bounds
- `total_weeks` in programme creation already correctly clamped to 1–52
