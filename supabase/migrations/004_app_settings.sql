-- App Settings table for persistent configuration
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the salary filter setting (off by default)
INSERT INTO app_settings (key, value) VALUES ('salary_only', 'false')
ON CONFLICT (key) DO NOTHING;

-- Allow service role full access
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view app settings"
  ON app_settings FOR SELECT
  USING (true);
