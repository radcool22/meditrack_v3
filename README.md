# MediTrack

MediTrack explains medical reports in plain language. Upload a blood test or lab report (PDF, JPG or PNG) and get a simple summary, the values that are out of range, and what to do next — then ask questions by text, voice, WhatsApp or a phone call.

Built for people in India who find lab reports hard to read, in English, Hindi, Marathi, Gujarati and Malayalam.

## Features

- **Report analysis** — OCR (Google Vision) turns the report into structured values; GPT-4o writes a summary at a Class 8 reading level.
- **Chat and voice** — ask about a report by typing or speaking; answers can be read aloud (ElevenLabs).
- **Explainer videos** — a short video walking through the results, made by the render service (`meditrack-render`).
- **WhatsApp** — send a report photo and ask questions on WhatsApp.
- **Phone calls** — tap *Call me* and the MediTrack voice agent (Sarvam) rings you and talks through your reports; a summary is saved afterwards.
- **Phone login** — no passwords; sign in with an SMS code (Twilio).

## Running locally

```bash
npm install && npm install --prefix client && npm install --prefix server
cp server/.env.example server/.env   # then fill in the keys
npm run dev                          # client on :3000, server on :5001
```

Database migrations are in `server/migrations/` — run them in the Supabase SQL editor.
