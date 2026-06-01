-- Migration 007: bug & feature request tracking

CREATE SEQUENCE IF NOT EXISTS bug_report_ref_seq;

CREATE TABLE IF NOT EXISTS bug_reports (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  ref            INTEGER NOT NULL DEFAULT nextval('bug_report_ref_seq'),
  user_id        UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  url            TEXT    NOT NULL,
  page_title     TEXT    NOT NULL,
  notes          TEXT,
  screenshot_url TEXT,                -- base64 JPEG, compressed client-side
  user_agent     TEXT,
  report_type    TEXT    NOT NULL DEFAULT 'bug'  CHECK (report_type IN ('bug', 'feature')),
  status         TEXT    NOT NULL DEFAULT 'open' CHECK (status    IN ('open', 'resolved')),
  resolved_note  TEXT,
  resolved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bug_reports_created_at_idx ON bug_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS bug_reports_status_idx     ON bug_reports (status);
CREATE INDEX IF NOT EXISTS bug_reports_user_id_idx    ON bug_reports (user_id);

ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can file a report
CREATE POLICY "Users insert own bug reports" ON bug_reports
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can read their own reports
CREATE POLICY "Users read own bug reports" ON bug_reports
  FOR SELECT USING (user_id = auth.uid());

-- Service role (admin API routes) bypasses RLS — no extra policy needed
