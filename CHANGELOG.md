# Changelog

All notable changes to brigid.pro are documented here.

## [Unreleased]

### Features (2026-06-07 — Automated Audit — Scenario B: Clean Run)

**Wellbeing Check-in** (`supabase/migrations/009_wellbeing_checkins.sql`, `app/api/portal/checkin/route.ts`, `components/client/WellbeingCheckin.tsx`)
- New pre-session check-in for clients: rate sleep quality, stress level, and muscle soreness (1–5 scale) before each session.
- Automatically surfaces at the top of each uncompleted session in the client portal; dismissable and skippable.
- `POST /api/portal/checkin` — client-only write; validates all three scores (integer 1–5); deduplicates per session.
- `GET /api/portal/checkin?sessionId=|clientId=` — client fetches own history; PT fetches their client's check-ins (agreement gate).
- RLS: clients have full access to their own rows; PTs have read-only access via agreement join.
- Migration 009 applied to production DB: `wellbeing_checkins` table, CHECK constraints on score columns, three indexes.

**Personal Records Tracking** (`app/api/portal/records/route.ts`)
- New `GET /api/portal/records?clientId=` endpoint that scans all completed session items and surfaces lifetime bests per exercise per metric.
- Tracked metrics: `weight_kg`, `reps`, `distance_km`, `duration_minutes`.
- Results grouped by category, sorted by exercise name. Both client and PT can query (PT requires agreement gate).
- Returns `PersonalRecord[]` with `exercise_name`, `metric`, `value`, `unit`, `achieved_at`, and `session_title` for context.

**Client Adherence API** (`app/api/pt/adherence/route.ts`)
- New `GET /api/pt/adherence?clientId=&weeks=` endpoint (PT-only) returning week-by-week scheduled vs completed session counts for any client.
- Returns `WeekAdherence[]` with `week_start` (ISO Monday), `scheduled`, `completed`, and `rate` (0–1).
- Defaults to last 12 weeks, configurable up to 52.
- Supports future visualisation in the PT client view (adherence chart).

### Security Fixes (2026-06-06 — Automated Audit)

- **BUG-20 / CRITICAL (RESOLVED)**: `javascript:` and `data:` URI injection in doc storage URL fields via `PATCH /api/agreements/[id]`.
  - **Root cause**: The PATCH route had no URL-protocol validation for `parq_storage_url`, `waiver_storage_url`, `consent_storage_url`. A PT could store `javascript:alert(document.cookie)` — this URL then rendered as an `<a href>` in both the PT drawer and the client's onboarding/account pages, creating a stored XSS vector against clients.
  - **Secondary cause**: `ClientProfileDrawer.handleSave()` wrote directly to Supabase (bypassing the API route), so earlier API-level guards were ineffective against the UI path. The auth cookie (`sb-*`) is not HttpOnly, meaning a PT could also extract their JWT and craft direct Supabase REST calls.
  - **Fix layer 1**: `app/api/agreements/[id]/route.ts` — added `URL` protocol check for all three doc URL fields; returns 400 with field-specific error for any non-http/https value.
  - **Fix layer 2**: `components/pt/ClientProfileDrawer.tsx` — `handleSave()` now calls `fetch('/api/agreements/[id]', PATCH)` instead of direct `supabase.from().update()`, routing all saves through the validated API. Unused `createClient` import removed.
  - **Fix layer 3**: PostgreSQL CHECK constraints added to `client_agreements` (migration `008_doc_url_protocol_constraint.sql`, applied 2026-06-06) — enforces `http/https` protocol at DB level regardless of how the update arrives.
  - **Test payloads confirmed blocked**: `javascript:alert(1)`, `data:text/html,<script>`, `vbscript:msgbox(1)`, direct service-role REST bypass.

### Audit Results (2026-06-06)

**Data Boundary, Robustness & Injection Resiliency Audit** — Automated three-suite testing of all critical input vectors with authenticated live session.

- **Suite A (Happy Path)**: 4 vectors ✓ (GET sessions, POST exercises, POST bug-reports, auth/role checks)
- **Suite B (Fringe)**: 19 boundary tests — all ✓ (enum bounds, 1000-char payloads, unicode/emoji, temporal extremes, near-max numerics)
- **Suite C (Invalid)**: 24 injection/invalid tests — 22 ✓, 2 failures (BUG-20 above)

**Security Summary**:
- SQL injection: SAFE (parameterized queries throughout)
- XSS — stored HTML in exercises/sessions/notes: SAFE (React JSX auto-escaping)
- XSS — email templates: SAFE (`escapeHtml()` on all interpolated user data)
- Protocol injection in doc URLs: **WAS VULNERABLE → FIXED** (three-layer guard now active)
- Protocol injection in bug-report URL field: SAFE (pre-existing guard)
- IDOR / cross-account access: SAFE (ownership checks + RLS on all endpoints)
- Field injection (non-whitelisted keys): SAFE (field whitelists on all PATCH handlers)
- Role enforcement: SAFE (PT-only and client-only endpoints correctly guarded)

**Files modified**: `app/api/agreements/[id]/route.ts`, `components/pt/ClientProfileDrawer.tsx`
**Migration applied**: `supabase/migrations/008_doc_url_protocol_constraint.sql`

---

### Fixed

- **BUG-9**: `/api/exercises` POST endpoint — fixed unhandled TypeError when `name` parameter is numeric type instead of string. Now returns 400 bad request with "Name is required" instead of 500 error.
  - **Root cause**: Missing type check before calling `.trim()` on `name` field
  - **Fix**: Added `typeof name !== 'string'` validation
  - **Affected endpoint**: `POST /api/exercises`
  - **Payload**: `{ name: 12345, category: "forging" }`

- **BUG-10**: `/api/agreements` PATCH endpoint — fixed unhandled PostgreSQL type error when `manual_price_numeric` is a non-numeric string. Now returns 400 bad request with proper error message instead of 500 error.
  - **Root cause**: Missing NaN validation after `Number()` coercion
  - **Fix**: Added `isNaN()` check to validate numeric coercion
  - **Affected endpoint**: `PATCH /api/agreements/:id`
  - **Payload**: `{ manual_price_numeric: "free" }`

### Audit Results (2026-06-05)

**Data Boundary, Robustness & Injection Resiliency Audit** — Live browser testing with authenticated PT session against all critical input vectors.

- **Suite A (Happy Path)**: All 6 vectors ✓ (GET sessions, POST programmes/exercises/templates/bug-reports, PATCH agreements)
- **Suite B (Fringe)**: 18 tests — 16 ✓, 2 failures (both BUG-14)
- **Suite C (Invalid)**: 32 tests — 28 ✓, 4 failures (BUG-15, BUG-16 ×3)

**Bugs Found & Fixed**:
- **BUG-14** (`PATCH /api/agreements`, `POST /api/clients`): `manual_price_numeric` ≥ 1e308 bypasses `isNaN()` guard, causing PostgreSQL numeric overflow → 500. Fixed: added `isFinite()` + upper-bound `> 1,000,000` check in both routes. Returns 400.
- **BUG-15** (`POST /api/programmes`): No category enum validation — any string reaches the DB and causes 500 "invalid input value for enum". Fixed: added `validCategories` guard matching the exercises route pattern.
- **BUG-16** (`PATCH /api/programmes/[id]`): Three gaps — (1) invalid category → 500, (2) empty/whitespace title accepted and stored, (3) payload with no whitelisted fields sends `{}` to DB → 500. Fixed: enum check, title trim+empty guard, no-valid-fields early return.

**Security Summary**:
- SQL injection: SAFE (parameterized queries)
- XSS (stored): SAFE (no `dangerouslySetInnerHTML` anywhere in codebase)
- XSS (email): SAFE (`escapeHtml()` on all interpolated user data)
- Protocol injection: SAFE (http/https guard on all URL fields)
- IDOR: SAFE (ownership checks + RLS)
- Field injection: SAFE (field whitelists on all PATCH handlers)

**Files modified**: `app/api/agreements/[id]/route.ts`, `app/api/clients/route.ts`, `app/api/programmes/route.ts`, `app/api/programmes/[id]/route.ts`

---

### Audit Results (2026-06-04)

**Data Boundary, Robustness & Injection Resiliency Audit** — Three-suite systematic testing of all critical input vectors.

- **Suite A (Happy Path)**: Standard schema-compliant data ✓
- **Suite B (Fringe)**: Boundary values, 1000-char payloads, unicode/emoji, temporal edges ✓
- **Suite C (Invalid)**: Type mismatches, XSS, HTML injection, SQL injection, schema violations ✓

**Security Summary**:
- SQL injection: SAFE (parameterized queries)
- XSS: SAFE (stored verbatim; frontend escaping required)
- Email XSS: SAFE (`escapeHtml()` applied)
- IDOR/Auth: SAFE (proper access controls)
- Protocol validation: SAFE (javascript:/data: URIs blocked)

**Findings**: 2 validation bugs found and fixed. No security vulnerabilities discovered.
