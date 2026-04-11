import 'dotenv/config'
import { createServer } from 'http'
import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import { parse as parseUrl } from 'url'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

import authRouter from './routes/auth.js'
import reportsRouter from './routes/reports.js'
import analysisRouter from './routes/analysis.js'
import chatRouter from './routes/chat.js'
import { handleTtsConnection } from './services/elevenLabsTts.js'

const app = express()
const PORT = process.env.PORT || 5001

app.use(cors())
app.use(express.json())

app.use('/api/auth', authRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/analysis', analysisRouter)
app.use('/api/chat', chatRouter)

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

// Serve built React client in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../client/dist')
  app.use(express.static(clientDist))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

// ── ElevenLabs test endpoint (debug only) ────────────────────────────
app.post('/api/test-voice', async (req, res) => {
  const VOICE_ID  = '9BWtsMINqrJLrRacOk9x' // Aria
  const TEST_TEXT = 'Hello, your blood test results look mostly normal. Your haemoglobin is slightly low.'

  console.log('[TEST] /api/test-voice called, forwarding to ElevenLabs REST API')

  try {
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: TEST_TEXT,
          model_id: 'eleven_flash_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0, use_speaker_boost: true },
        }),
      }
    )

    console.log('[TEST] ElevenLabs response status:', upstream.status)

    if (!upstream.ok) {
      const errText = await upstream.text()
      console.error('[TEST] ElevenLabs error body:', errText)
      return res.status(upstream.status).json({ error: errText })
    }

    res.setHeader('Content-Type', 'audio/mpeg')
    const reader = upstream.body.getReader()
    let totalBytes = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.length
      res.write(Buffer.from(value))
    }
    console.log('[TEST] streamed', totalBytes, 'bytes to client')
    res.end()
  } catch (err) {
    console.error('[TEST] fetch error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Upgrade Express to an HTTP server so WebSocket can share the same port
const server = createServer(app)

const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
  const { pathname } = parseUrl(req.url)
  if (pathname === '/ws/tts') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req)
    })
  } else {
    socket.destroy()
  }
})

wss.on('connection', (ws, req) => {
  handleTtsConnection(ws)
})

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
