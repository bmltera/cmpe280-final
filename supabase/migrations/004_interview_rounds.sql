-- Interview Rounds: per-tracked-job interview scheduling and notes.

CREATE TABLE IF NOT EXISTS interview_rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracked_job_id UUID NOT NULL REFERENCES user_tracked_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  round_name TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  interviewer TEXT,
  notes TEXT,
  outcome TEXT NOT NULL DEFAULT 'pending'
    CHECK (outcome IN ('pending', 'passed', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_rounds_tracked_job_id
  ON interview_rounds(tracked_job_id);
CREATE INDEX IF NOT EXISTS idx_interview_rounds_user_id
  ON interview_rounds(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_rounds_scheduled_at
  ON interview_rounds(scheduled_at);

CREATE TRIGGER update_interview_rounds_updated_at
  BEFORE UPDATE ON interview_rounds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE interview_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own interview rounds"
  ON interview_rounds FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interview rounds"
  ON interview_rounds FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interview rounds"
  ON interview_rounds FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own interview rounds"
  ON interview_rounds FOR DELETE
  USING (auth.uid() = user_id);
