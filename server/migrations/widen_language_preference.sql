-- Migration: widen users.language_preference to support mr/gu/ml
-- Run once in Supabase SQL Editor
-- Existing en/hi rows and the column default are unaffected — this only
-- widens the CHECK constraint so WhatsApp language-switch can persist
-- Marathi/Gujarati/Malayalam choices via setUserLanguagePreference()
-- (server/services/whatsappService.js).

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_language_preference_check;
ALTER TABLE users ADD CONSTRAINT users_language_preference_check
  CHECK (language_preference IN ('en', 'hi', 'mr', 'gu', 'ml'));
