-- WhatsApp conversation state — one row per WhatsApp number
-- user_id is nullable: unregistered WhatsApp users can still have a session row
-- current_report_id is nullable: set when the user is discussing a specific report
-- state tracks the conversation FSM ('idle', 'awaiting_report_choice', etc.)
CREATE TABLE whatsapp_sessions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id             TEXT        UNIQUE NOT NULL,
  user_id           UUID        REFERENCES users(id) ON DELETE SET NULL,
  current_report_id UUID        REFERENCES reports(id) ON DELETE SET NULL,
  state             TEXT        NOT NULL DEFAULT 'idle',
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_sessions_user ON whatsapp_sessions(user_id);
