-- JobTracker Database Schema
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- JOBS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  salary TEXT,
  location TEXT,
  job_type TEXT,
  application_url TEXT NOT NULL,
  source_name TEXT,
  source_url TEXT,
  raw_source_text TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  unique_hash TEXT UNIQUE NOT NULL
);

-- ============================================================
-- USER TRACKED JOBS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS user_tracked_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Applied'
    CHECK (status IN ('Applied', 'OA', 'Interview', 'Offer', 'Rejected')),
  notes TEXT,
  applied_at TIMESTAMPTZ,
  last_status_change_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- ============================================================
-- USER DISMISSED JOBS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS user_dismissed_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- ============================================================
-- USER APPLY EVENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS user_apply_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('apply_clicked', 'apply_confirmed', 'apply_abandoned')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_scraped_at ON jobs(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_unique_hash ON jobs(unique_hash);
CREATE INDEX IF NOT EXISTS idx_tracked_user_id ON user_tracked_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_tracked_status ON user_tracked_jobs(status);
CREATE INDEX IF NOT EXISTS idx_dismissed_user_id ON user_dismissed_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_apply_events_user_id ON user_apply_events(user_id);

-- ============================================================
-- AUTO-UPDATE TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tracked_jobs_updated_at
  BEFORE UPDATE ON user_tracked_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Drop if exists to avoid errors on re-run
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Profiles: users can read/update their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Jobs: anyone can read, only service role can write
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view jobs"
  ON jobs FOR SELECT
  USING (true);

-- Tracked Jobs: users can CRUD their own
ALTER TABLE user_tracked_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tracked jobs"
  ON user_tracked_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tracked jobs"
  ON user_tracked_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tracked jobs"
  ON user_tracked_jobs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tracked jobs"
  ON user_tracked_jobs FOR DELETE
  USING (auth.uid() = user_id);

-- Dismissed Jobs: users can manage their own
ALTER TABLE user_dismissed_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dismissed jobs"
  ON user_dismissed_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dismissed jobs"
  ON user_dismissed_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Apply Events: users can view/insert their own
ALTER TABLE user_apply_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own apply events"
  ON user_apply_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own apply events"
  ON user_apply_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);
