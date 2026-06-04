# Changelog

All notable changes to brigid.pro are documented here.

## [Unreleased]

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
