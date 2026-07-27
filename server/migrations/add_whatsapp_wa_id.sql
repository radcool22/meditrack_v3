-- Nullable column linking a report to the WhatsApp number that requested its video.
-- NULL for all existing rows and all web-initiated videos — no impact on any existing data.
ALTER TABLE reports ADD COLUMN whatsapp_wa_id TEXT;
