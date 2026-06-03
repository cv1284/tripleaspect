# Changelog

## 2026-06-03 — Data Boundary, Robustness & Injection Resiliency Audit

### Security Fixes

**BUG-BRIGID-14 (MEDIUM) — `POST /api/bug-reports` url field accepted non-http(s) URIs**
The `url` field accepted any string including `javascript:` and `data:` URIs.
These were stored in `bug_reports.url` and inserted into the admin HTML notification
email as a bare `href` attribute. `escapeHtml()` sanitises entity characters but does
not block protocol injection. Direct navigation to the admin panel rendered the URL as
an `<a href>` (React 18 blocks `javascript:` in href, but `data:` and other schemes
were not blocked in the raw HTML email).
Fix: added `new URL(val, baseOrigin)` parse + `http:`/`https:` protocol whitelist in
the POST handler (mirrors the existing guard already present in `PATCH /api/client/docs`).
Relative paths (e.g. `/pt/clients`) are still accepted as the BugReportButton sends
`window.location.pathname + window.location.search`.

**BUG-BRIGID-15 (MEDIUM) — `POST /api/pt/logo` accepted SVG uploads**
`image/svg+xml` was in the server-side `ALLOWED_TYPES` list for brand logo upload.
SVG files can embed `<script>` elements that execute when the Supabase Storage URL is
opened directly in a browser tab (even though `<img>` tags sandbox SVG JavaScript).
Previous audit (2026-06-01) noted `<img>` provides adequate protection; this fix applies
a defense-in-depth posture by removing the SVG upload path entirely — the platform has
no requirement for SVG logos and the removal eliminates the attack surface.
Fix: removed `image/svg+xml` from server `ALLOWED_TYPES`; updated client `accept`
attribute and hint copy to match; removed `svg` from DELETE cleanup loop; removed
special `file.type === 'image/svg+xml' ? 'svg'` ext branch.

### Bug Fixes

**BUG-BRIGID-16 (LOW) — `POST /api/programmes` NaN propagation on non-numeric `total_weeks`**
`parseInt('abc')` returns NaN; `Math.max(NaN, 1)` and `Math.min(NaN, 52)` both
propagate NaN per JS spec. `JSON.stringify({ total_weeks: NaN })` serialises as `null`,
which then hits a NOT NULL database constraint and returns a 500 instead of a 400.
`Array.from({ length: NaN })` creates an empty array, so no week rows are scaffolded.
Fix: added explicit `isNaN` guard returning HTTP 400 before the clamp logic.

**BUG-BRIGID-17 (LOW) — `POST /api/clients` manual_price_numeric = 0 silently discarded**
Falsy check `manual_price_numeric ? parseFloat(...) : null` caused a price of £0
(free client on record) to be stored as `null` rather than `0.00`, discarding the
user's explicit intent. The corresponding PATCH handler correctly used direct assignment.
Fix: changed to `!= null` check so zero is correctly persisted. Behaviour is now
consistent between POST (client creation) and PATCH (agreement update).

### Audit Findings — No Fix Required

- SQL injection (all endpoints) — Supabase ORM parameterised queries; payloads stored
  as literals, never executed ✅
- XSS in text fields rendered by React JSX — auto-escaped; cannot execute ✅
- `javascript:` URI in doc URL fields (`/api/client/docs`) — existing protocol guard ✅
- Enum fields (`status`, `agreement_model`, `category`) — all validate and return 400 ✅
- `program_length_weeks` out-of-range (0, 261) — 400 returned correctly ✅
- Missing required fields (`email`, `title`, `url`) — 400 returned correctly ✅
- Session DELETE IDOR — 404 for non-owned sessions; RLS enforces ownership ✅
- Field injection (sending `pt_id`/`client_id` in PATCH bodies) — field whitelists
  correctly strip unrecognised keys across all PATCH handlers ✅
- Programme assignment with invalid `startDate` — existing `isNaN` guard returns 400 ✅
- Auth on all endpoints — 401/403 returned for unauthenticated/wrong-role callers ✅

### Validation Rules Reference (cumulative)

| Field | Endpoint | Rule |
|-------|----------|------|
| `url` | POST /api/bug-reports | `http:` or `https:` only (relative paths permitted) |
| `logo` (file) | POST /api/pt/logo | JPEG, PNG or WebP only (SVG removed) |
| `total_weeks` | POST /api/programmes | Integer 1–52; NaN → 400 |
| `manual_price_numeric` | POST /api/clients | `!= null` check; 0 stored correctly |
| `program_length_weeks` | POST /api/clients, PATCH /api/agreements | Integer 1–260 or null |
| `status` | PATCH /api/agreements | `active` \| `attention` \| `paused` \| `inactive` |
| `agreement_model` | POST /api/clients, PATCH /api/agreements | `subscription` \| `fixed_block` \| `hybrid` |
| `category` | POST /api/exercises | `healing` \| `forging` \| `verse` |
| `*_storage_url` | PATCH /api/client/docs | `http:` or `https:` only |

---

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
