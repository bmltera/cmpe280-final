-- Migration: Tracked Senders for Gmail Sync

CREATE TABLE IF NOT EXISTS user_tracked_senders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_tracked_senders_user_id ON user_tracked_senders(user_id);

ALTER TABLE user_tracked_senders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tracked senders"
  ON user_tracked_senders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
