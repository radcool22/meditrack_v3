-- One-time reset: clears all analysis rows and sets reports back to pending
-- so every report gets re-analyzed in English on next page visit.
-- Run once in Supabase SQL Editor.

DELETE FROM report_analyses;
UPDATE reports SET status = 'pending' WHERE status = 'done';
