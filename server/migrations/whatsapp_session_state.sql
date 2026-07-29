-- Adds conversation-state columns to whatsapp_sessions.
-- All columns are nullable and additive — no impact on existing rows, other tables,
-- or any existing website code. language has DEFAULT 'en' so Postgres backfills
-- existing rows automatically (no manual UPDATE needed).

ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS language        TEXT DEFAULT 'en';
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS pending_action  TEXT;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS pending_data    JSONB;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS recent_history  JSONB;
