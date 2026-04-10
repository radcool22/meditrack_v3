import { WebSocket } from 'ws'

const VOICE_IDS = {
  'hi-IN': 'mActWQg9kibLro6Z2ouY',
  'en-IN': 'PpXxSapWoo4j3JoF2LPQ',
}

/**
 * Handle a /ws/tts WebSocket connection.
 * Protocol:
 *   Client → { type: 'speak', text: '...', lang: 'en-IN' }
 *   Server → binary MP3 chunks  (multiple messages)
 *   Server → { type: 'done' }   (all chunks sent)
 *   Server → { type: 'error' }  (on failure)
 */
export function handleTtsConnection(ws) {
  let elevenWs = null

  ws.on('message', (data, isBinary) => {
    if (isBinary) return

    let msg
    try { msg = JSON.parse(data.toString()) } catch { return }

    if (msg.type !== 'speak' || !msg.text?.trim()) {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'done' }))
      return
    }

    console.log('[TTS] speak request received, text length:', msg.text.length)

    // Close any previous ElevenLabs session
    elevenWs?.close()

    let doneSent = false

    function sendDone() {
      if (!doneSent && ws.readyState === ws.OPEN) {
        doneSent = true
        console.log('[TTS] sending done to client')
        ws.send(JSON.stringify({ type: 'done' }))
      }
    }

    const voiceId = VOICE_IDS[msg.lang] ?? VOICE_IDS['en-IN']

    elevenWs = new WebSocket(
      `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input` +
        `?model_id=eleven_flash_v2_5&output_format=mp3_44100_128`,
      { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } }
    )

    elevenWs.on('open', () => {
      console.log('[TTS] ElevenLabs WS opened, sending text')
      // BOS — voice settings
      elevenWs.send(JSON.stringify({
        text: ' ',
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0, use_speaker_boost: true },
      }))
      // Text to speak (trailing space flushes the final word)
      elevenWs.send(JSON.stringify({ text: msg.text.trim() + ' ' }))
      // EOS
      elevenWs.send(JSON.stringify({ text: '' }))
    })

    elevenWs.on('message', (raw) => {
      let chunk
      try { chunk = JSON.parse(raw.toString()) } catch { return }

      if (chunk.audio) {
        const audioBuf = Buffer.from(chunk.audio, 'base64')
        console.log('[TTS] audio chunk forwarded:', audioBuf.length, 'bytes')
        if (ws.readyState === ws.OPEN) ws.send(audioBuf)
      }

      if (chunk.isFinal) {
        console.log('[TTS] isFinal received')
        sendDone()
        elevenWs.close()
      }
    })

    // Always send done when ElevenLabs closes, in case isFinal never arrives
    elevenWs.on('close', () => {
      console.log('[TTS] ElevenLabs WS closed, doneSent:', doneSent)
      sendDone()
    })

    elevenWs.on('error', (err) => {
      console.error('[TTS] ElevenLabs error:', err.message)
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'error', message: 'TTS error' }))
    })
  })

  ws.on('close', () => elevenWs?.close())
  ws.on('error', (err) => {
    console.error('[TTS] client WS error:', err.message)
    elevenWs?.close()
  })
}
