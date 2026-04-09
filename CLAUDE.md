## Workflow Orchestration

### 1. Plan Node Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately - don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One tack per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update "tasks/lessons.md" with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes - don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fizing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests - then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management
1. **Plan First**: Write plan to tasks/todo.md" with checkable items

## Core Principles
- **SimpLicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimat Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

## Product Overview

A bilingual (English/Hindi) web app called "MediTrack" for Indian users to upload medical reports, get AI-powered simplified analysis, and have text/voice conversations about their results. Target users are elderly and middle-class Indians who cannot understand the technical language and meaning of data in the medical reports like blood tests, liver tests etc and have to go to the doctor to ask for basic understanding in simple language.

## System Flow

Authentication --> Unique user identification via phone number (India +91 only)
               --> Send OTP via SMS to verify phone number

OCR --> Accept PDF, JPG, PNG
    --> Use Google Vision / Document AI API for OCR
    --> Extract all information
    --> Keep the data accurate

Convert raw OCR data into structured data

Reasoning -->
Use a OpenAI GPT model API for reasoning

User Prompts and Output -->

Accept user input in natural language either via voice or text. Input the structured report JSON and output simple explanations of the user prompts, outlier/abnormal values, and any suggestions if you have.

Keep language simple.

Store reports in Supabase database for future reference

## Tech Stack

Frontend: React and Tailwind CSS
Backend: Node.js and Express
Reasoning AI/LLM: OpenAI API GPT
Voice Conversation: Gemini Live API
OCR: Google Vision / Document AI
OTP: Twilio
DB: Supabase

## Things to Remember

Phone number is the unique user identifier, meaning no email/password. Only accept phone numbers with +91 country code for India.
OTP sent via Twilio SMS
Accepted formats for reports are JPG, PNG, and PDF
Files uploaded to Supabase DB

## Repo Structure

/
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Route-level pages
│   │   ├── hooks/           # Custom React hooks
│   │   ├── context/         # Auth, language context
│   │   ├── locales/         # en.json and hi.json translation files
│   │   └── utils/
│   └── public/
├── server/                  # Express backend
│   ├── routes/              # auth.js, reports.js, analysis.js
│   ├── controllers/
│   ├── middleware/          # auth middleware, file upload
│   ├── services/            # openai.js, supabase.js, twilio.js, gemini.js
│   └── utils/
└── CLAUDE.md

## Build

cd client && npm run dev    # frontend on :3000
cd server && npm run dev    # backend on :5000
npm test / npm run build

## Environment Variables

Server
PORT=5000
NODE_ENV=development

Twilio (OTP)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

OpenAI (LLM analysis)
OPENAI_API_KEY=

Google Gemini (voice)
GEMINI_API_KEY=

Google Vision/Document AI (OCR)
GOOGLE_CLOUD_API_KEY=

JWT
JWT_SECRET=
JWT_EXPIRES_IN=7d

Supabase (database + file storage)
SUPABASE_URL=                        # e.g. https://xyzabc.supabase.co
SUPABASE_ANON_KEY=                   # safe to use client-side
SUPABASE_SERVICE_ROLE_KEY=           # server-only, never expose to client
SUPABASE_STORAGE_BUCKET=reports      # bucket name for uploaded report files

## Database Schema

All Supabase tables have Row Level Security enabled — users can only access their own rows.

-- Users (one row per person, identified by phone number)
CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number        TEXT UNIQUE NOT NULL,
  name                TEXT,
  language_preference TEXT DEFAULT 'en' CHECK (language_preference IN ('en', 'hi')),
  created_at          TIMESTAMPTZ DEFAULT now(),
  last_login_at       TIMESTAMPTZ
);

-- OTP attempts (each SMS code gets its own row)
CREATE TABLE otp_verifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  otp_code     TEXT NOT NULL,
  is_used      BOOLEAN DEFAULT false,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Uploaded medical reports
CREATE TABLE reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  file_url        TEXT NOT NULL,  -- Supabase Storage URL
  file_type       TEXT NOT NULL CHECK (file_type IN ('pdf', 'jpg', 'png')),
  ocr_raw_text    TEXT,           -- Raw output from Google Vision/Document AI API
  structured_data JSONB,          -- Parsed report fields
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  uploaded_at     TIMESTAMPTZ DEFAULT now()
);

-- LLM analysis output (separate from report so analysis can be re-run)
CREATE TABLE report_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  summary         TEXT,
  abnormal_values JSONB,  -- [{ name, value, normal_range, flag }]
  suggestions     JSONB,  -- ["..."]
  language        TEXT DEFAULT 'en',
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Chat history (text and voice turns, tied to a report)
CREATE TABLE chat_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id    UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content      TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'voice')),
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_reports_user_id         ON reports(user_id);
CREATE INDEX idx_report_analyses_report  ON report_analyses(report_id);
CREATE INDEX idx_chat_messages_report    ON chat_messages(report_id);
CREATE INDEX idx_chat_messages_user      ON chat_messages(user_id);
CREATE INDEX idx_otp_phone_expires       ON otp_verifications(phone_number, expires_at);

## Constraints

Analysis must complete in under 5 seconds
OCR accuracy: Optimise prompts for standard Indian lab report formats (e.g. SRL, Dr. Lal PathLabs)
All UI must work well on a 375px viewport; laptop is secondary but nonetheless still important
LLM output must avoid medical jargon — write for a Class 8 reading level
Never log raw report content; only structured JSON after parsing