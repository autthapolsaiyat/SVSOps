-- db/init/22-session_policy.sql
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expires_at   TIMESTAMPTZ NOT NULL DEFAULT now() + interval '2 hours',
  ADD COLUMN IF NOT EXISTS revoked      BOOLEAN     NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_sessions_user_active
  ON sessions(user_id)
  WHERE ended_at IS NULL AND revoked = FALSE;

