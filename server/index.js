import 'dotenv/config'
import { createServer } from 'http'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { WebSocketServer } from 'ws'
import { parse as parseUrl } from 'url'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

import authRouter from './routes/auth.js'
import reportsRouter from './routes/reports.js'
import analysisRouter from './routes/analysis.js'
import chatRouter from './routes/chat.js'
import videosRouter from './routes/videos.js'
import whatsappRouter from './routes/whatsappRoutes.js'
import { handleTtsConnection } from './services/elevenLabsTts.js'

// Express 4 doesn't catch rejected promises from async handlers, and Node
// exits on an unhandled rejection — one failed OpenAI call would take the
// whole server down for every user. Log it instead; handlers own their errors.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason instanceof Error ? reason.message : reason)
})

const app = express()
const PORT = process.env.PORT || 8080

// Behind Fly's proxy: trust one hop so req.ip is the real client (rate limits).
app.set('trust proxy', 1)

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  next()
})
// The client is served from this same origin; no other site may call the API.
app.use(cors({ origin: process.env.APP_BASE_URL || false }))
// Keep the raw bytes — the WhatsApp webhook signature is computed over them.
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf } }))

app.use('/api/auth', authRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/analysis', analysisRouter)
app.use('/api/chat', chatRouter)
app.use('/api/videos', videosRouter)
app.use('/api/whatsapp', whatsappRouter)

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

// Unknown API routes are 404s, not the SPA's index.html.
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }))

// Serve built React client in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../client/dist')
  app.use(express.static(clientDist))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

// Errors thrown before a handler runs (bad JSON, upload filter/limits) — JSON, never an HTML stack page.
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE'
    return res.status(tooBig ? 413 : 400).json({ error: tooBig ? 'File is larger than 20 MB' : err.message })
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' })
  if (err.message === 'Only PDF, JPG, and PNG files are allowed') return res.status(400).json({ error: err.message })
  console.error('Request error:', err.message)
  return res.status(500).json({ error: 'Something went wrong' })
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

wss.on('connection', (ws) => {
  handleTtsConnection(ws)
})

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
