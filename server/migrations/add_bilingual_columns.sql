-- Migration: add per-language analysis columns to report_analyses
-- Run once in Supabase SQL Editor
-- After this migration, new reports store both English and Hindi analysis
-- in the same row. Old rows keep summary/abnormal_values/suggestions as fallback.

ALTER TABLE report_analyses
  ADD COLUMN IF NOT EXISTS summary_en          TEXT,
  ADD COLUMN IF NOT EXISTS summary_hi          TEXT,
  ADD COLUMN IF NOT EXISTS abnormal_values_en  JSONB,
  ADD COLUMN IF NOT EXISTS abnormal_values_hi  JSONB,
  ADD COLUMN IF NOT EXISTS suggestions_en      JSONB,
  ADD COLUMN IF NOT EXISTS suggestions_hi      JSONB;
