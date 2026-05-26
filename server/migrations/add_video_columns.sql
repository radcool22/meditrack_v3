ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS video_status       TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS video_url          TEXT,
  ADD COLUMN IF NOT EXISTS video_job_id       TEXT,
  ADD COLUMN IF NOT EXISTS video_error        TEXT,
  ADD COLUMN IF NOT EXISTS video_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS video_generated_at TIMESTAMPTZ;

ALTER TABLE reports
  ADD CONSTRAINT reports_video_status_check
  CHECK (video_status IN ('none', 'generating', 'ready', 'failed'));
