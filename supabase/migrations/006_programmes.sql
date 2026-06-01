-- Migration 006: programme builder tables

CREATE TABLE IF NOT EXISTS programmes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pt_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  category     session_category,
  total_weeks  INTEGER NOT NULL DEFAULT 4,
  is_public    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS programme_weeks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id   UUID NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
  week_number    INTEGER NOT NULL,
  label          TEXT,
  UNIQUE (programme_id, week_number)
);

CREATE TABLE IF NOT EXISTS programme_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id       UUID NOT NULL REFERENCES programme_weeks(id) ON DELETE CASCADE,
  day_of_week   INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Mon, 7=Sun
  title         TEXT NOT NULL,
  category      session_category NOT NULL,
  notes         TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  template_id   UUID REFERENCES session_templates(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS programme_session_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_session_id  UUID NOT NULL REFERENCES programme_sessions(id) ON DELETE CASCADE,
  exercise_id           UUID NOT NULL REFERENCES exercises(id),
  sort_order            INTEGER NOT NULL DEFAULT 0,
  prescribed_metrics    JSONB NOT NULL DEFAULT '{}',
  custom_coaching_cues  TEXT,
  custom_youtube_url    TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS programme_weeks_programme_id_idx        ON programme_weeks (programme_id);
CREATE INDEX IF NOT EXISTS programme_sessions_week_id_idx          ON programme_sessions (week_id);
CREATE INDEX IF NOT EXISTS programme_session_items_session_id_idx  ON programme_session_items (programme_session_id);

-- Updated-at trigger for programmes
CREATE OR REPLACE FUNCTION fn_touch_programme_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_programmes_updated_at
  BEFORE UPDATE ON programmes
  FOR EACH ROW EXECUTE FUNCTION fn_touch_programme_updated_at();

-- RLS
ALTER TABLE programmes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE programme_weeks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE programme_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE programme_session_items ENABLE ROW LEVEL SECURITY;

-- PT owns their programmes; public programmes are readable by all PTs
CREATE POLICY "PT manages own programmes" ON programmes
  FOR ALL USING (pt_id = auth.uid());

CREATE POLICY "PT reads public programmes" ON programmes
  FOR SELECT USING (is_public = true);

-- Sub-tables: accessible if the parent programme is accessible
CREATE POLICY "PT accesses own programme_weeks" ON programme_weeks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM programmes p WHERE p.id = programme_weeks.programme_id AND p.pt_id = auth.uid())
  );

CREATE POLICY "PT reads public programme_weeks" ON programme_weeks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM programmes p WHERE p.id = programme_weeks.programme_id AND p.is_public = true)
  );

CREATE POLICY "PT accesses own programme_sessions" ON programme_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM programme_weeks pw
      JOIN programmes p ON p.id = pw.programme_id
      WHERE pw.id = programme_sessions.week_id AND p.pt_id = auth.uid()
    )
  );

CREATE POLICY "PT reads public programme_sessions" ON programme_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM programme_weeks pw
      JOIN programmes p ON p.id = pw.programme_id
      WHERE pw.id = programme_sessions.week_id AND p.is_public = true
    )
  );

CREATE POLICY "PT accesses own programme_session_items" ON programme_session_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM programme_sessions ps
      JOIN programme_weeks pw ON pw.id = ps.week_id
      JOIN programmes p ON p.id = pw.programme_id
      WHERE ps.id = programme_session_items.programme_session_id AND p.pt_id = auth.uid()
    )
  );
