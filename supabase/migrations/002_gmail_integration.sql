-- Migration: Gmail Integration & Job Applications Tracker

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE application_status AS ENUM ('applied', 'in_review', 'interview_scheduled', 'offer', 'rejected');

-- ============================================================
-- USER TOKENS TABLE (For Gmail OAuth)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- JOB APPLICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  status application_status NOT NULL DEFAULT 'applied',
  date_applied TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recruiter_name TEXT,
  recruiter_email TEXT,
  gmail_thread_id TEXT NOT NULL,
  UNIQUE(user_id, company, role, gmail_thread_id)
);

-- ============================================================
-- APPLICATION EVENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS application_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  status application_status NOT NULL,
  event_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email_snippet TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUTO-UPDATE TRIGGERS
-- ============================================================
CREATE TRIGGER update_user_tokens_updated_at
  BEFORE UPDATE ON user_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_applications_updated_at
  BEFORE UPDATE ON job_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tokens"
  ON user_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own job applications"
  ON job_applications FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE application_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own application events"
  ON application_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM job_applications
      WHERE job_applications.id = application_events.application_id
      AND job_applications.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM job_applications
      WHERE job_applications.id = application_events.application_id
      AND job_applications.user_id = auth.uid()
    )
  );
