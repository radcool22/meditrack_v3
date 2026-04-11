-- Reset all analyses so reports re-run with shorter plain_explanation (tile layout)
DELETE FROM report_analyses;
UPDATE reports SET status = 'pending' WHERE status = 'done';
