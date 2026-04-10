# MediTrack Tasks

## Auth Flow (Step 1) ✓
## Report Upload (Step 4) ✓
## OCR + Analysis Pipeline (Step 5) ✓

---

## Chat & Voice (Step 6)

### Architecture

**Text Chat**
- POST /api/chat/:reportId — send message, receive AI response
- GET  /api/chat/:reportId/history — load existing messages
- OpenAI GPT-4o with report context (structured_data + analysis) in system prompt
- Auto-detects Hindi vs English from user message, replies in same language
- Class 8 reading level, no medical jargon
- Saves user + assistant turns to chat_messages table

**Voice Chat**
- WebSocket endpoint: ws://server:5001/ws/voice
- First message from client: { type: 'init', token, reportId }
- Server authenticates JWT, loads report context from Supabase
- Server creates Gemini Live session with report context as system instruction
- Audio in:  browser captures PCM 16kHz mono → binary WS → server → Gemini Live
- Audio out: Gemini Live PCM 24kHz → server → binary WS → browser AudioContext playback
- Transcription saved to chat_messages on turn complete

**UI (ReportPage)**
- Chat panel below report analysis
- Prominent Text/Voice mode toggle (pill tabs, large tap targets)
- Text mode: scrollable message thread + fixed bottom input + send button
- Voice mode: large mic button (tap to start/stop), animated state indicator, status label
- Loads conversation history on mount
- 375px mobile-first layout

### Backend Checklist
- [x] Install ws + @google/genai in server
- [x] server/services/prompts/chat.js — buildChatSystemPrompt(report, analysis)
- [x] server/controllers/chatController.js — sendMessage(), getHistory()
- [x] server/routes/chat.js — POST /:reportId, GET /:reportId/history
- [x] server/services/geminiLive.js — handleVoiceConnection(ws, req)
- [x] server/index.js — http.createServer + WebSocketServer on /ws/voice + mount chat route

### Frontend Checklist
- [x] client/vite.config.js — add /ws proxy (ws: true)
- [x] client/src/hooks/useChat.js — send message, load history, optimistic UI
- [x] client/src/hooks/useVoice.js — WebSocket + PCM capture + AudioContext playback
- [x] client/src/components/ChatPanel.jsx — full chat UI with mode toggle
- [x] client/src/pages/ReportPage.jsx — add ChatPanel below analysis sections
