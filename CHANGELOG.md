# Changelog

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
