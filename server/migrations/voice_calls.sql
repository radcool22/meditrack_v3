-- Phone calls with the MediTrack voice agent (Sarvam). Run once in Supabase SQL Editor.
-- One row per call. Outbound rows are created when the user taps "Call me" and are
-- matched to Sarvam's webhook by sarvam_attempt_id; inbound rows are created by the
-- webhook itself and are matched by interaction_id (Sarvam retries, so it is UNIQUE).
CREATE TABLE voice_calls (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        REFERENCES users(id) ON DELETE CASCADE,  -- null: unknown caller
  report_id         UUID        REFERENCES reports(id) ON DELETE SET NULL,
  direction         TEXT        NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  phone_number      TEXT        NOT NULL,
  language          TEXT        NOT NULL DEFAULT 'en',
  status            TEXT        NOT NULL DEFAULT 'calling'
                    CHECK (status IN ('calling', 'completed', 'no_answer', 'busy', 'failed')),
  sarvam_attempt_id TEXT        UNIQUE,
  interaction_id    TEXT        UNIQUE,
  duration_sec      NUMERIC,
  failure_reason    TEXT,
  transcript        JSONB,      -- [{ role: 'agent'|'user', text }]
  summary           TEXT,       -- written by us after the call, in the user's language
  urgent            BOOLEAN     NOT NULL DEFAULT false,
  whatsapp_sent     BOOLEAN     NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at          TIMESTAMPTZ
);

CREATE INDEX idx_voice_calls_user ON voice_calls(user_id, created_at DESC);

ALTER TABLE voice_calls ENABLE ROW LEVEL SECURITY;

-- The user agrees once to MediTrack calling them and sharing their reports on the call.
ALTER TABLE users ADD COLUMN IF NOT EXISTS voice_consent_at TIMESTAMPTZ;
