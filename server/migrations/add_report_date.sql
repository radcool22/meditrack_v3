-- Add report_date column to reports table.
-- Populated during OCR/analysis from the date printed on the document itself.
-- Nullable — falls back to uploaded_at when OCR cannot extract a date.

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS report_date DATE;

CREATE INDEX IF NOT EXISTS idx_reports_report_date ON reports(report_date);
