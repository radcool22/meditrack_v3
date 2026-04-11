import { WebSocket } from 'ws'

const VOICE_IDS = {
  'hi-IN': 'mActWQg9kibLro6Z2ouY',
  'en-IN': 'PpXxSapWoo4j3JoF2LPQ',
}

// ── Number-to-words helpers ──────────────────────────────────────────
const ones = ['zero','one','two','three','four','five','six','seven','eight','nine',
               'ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen',
               'seventeen','eighteen','nineteen']
const tens = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety']

function intToWords(n) {
  if (n < 0) return 'negative ' + intToWords(-n)
  if (n < 20) return ones[n]
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
  if (n < 1000) return ones[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + intToWords(n % 100) : '')
  if (n < 1000000) return intToWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + intToWords(n % 1000) : '')
  return intToWords(Math.floor(n / 1000000)) + ' million' + (n % 1000000 ? ' ' + intToWords(n % 1000000) : '')
}

function numberToWords(str) {
  // Range: 12-17 → "twelve to seventeen"  (only when both sides are numbers)
  str = str.replace(/\b(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\b/g, (_, a, b) => numberToWords(a) + ' to ' + numberToWords(b))

  // Decimal: 7.5 → "seven point five"
  str = str.replace(/\b(\d+)\.(\d+)\b/g, (_, int, dec) => {
    const decWords = dec.split('').map(d => ones[+d]).join(' ')
    return intToWords(+int) + ' point ' + decWords
  })

  // Integer
  str = str.replace(/\b(\d+)\b/g, (_, n) => intToWords(+n))

  return str
}

// ── Main preprocessing function ──────────────────────────────────────
export function preprocessForVoice(text) {
  if (!text) return text

  // 1. Remove markdown symbols
  text = text.replace(/[*#_`]/g, '')

  // 2. Replace leading bullet/dash on a line with a comma pause
  text = text.replace(/^[\s]*[-•]\s+/gm, ', ')

  // 3. Medical units — order matters (longer patterns first)
  const unitMap = [
    [/\bµg\/dL\b/gi, 'micrograms per deciliter'],
    [/\bug\/dL\b/gi,  'micrograms per deciliter'],
    [/\bmg\/dL\b/gi,  'milligrams per deciliter'],
    [/\bmg\/dl\b/gi,  'milligrams per deciliter'],
    [/\bg\/dL\b/gi,   'grams per deciliter'],
    [/\bmmol\/L\b/gi, 'millimoles per liter'],
    [/\bmIU\/L\b/gi,  'milli international units per liter'],
    [/\bIU\/L\b/gi,   'international units per liter'],
    [/\bmmHg\b/gi,    'millimeters of mercury'],
    [/\bbpm\b/gi,     'beats per minute'],
    [/\bBMI\b/g,      'B M I'],
    [/\bHbA1c\b/gi,   'H b A 1 c'],
    [/\bVO2\b/gi,     'V O 2'],
    [/\bWBC\b/g,      'W B C'],
    [/\bRBC\b/g,      'R B C'],
    [/\bHDL\b/g,      'H D L'],
    [/\bLDL\b/g,      'L D L'],
    [/\bTSH\b/g,      'T S H'],
    [/\bALT\b/g,      'A L T'],
    [/\bAST\b/g,      'A S T'],
    [/\bGFR\b/g,      'G F R'],
    [/\beGFR\b/g,     'estimated G F R'],
    [/\bPSA\b/g,      'P S A'],
    [/\bCRP\b/g,      'C R P'],
    [/\bESR\b/g,      'E S R'],
    [/\bPT\b/g,       'P T'],
    [/\bINR\b/g,      'I N R'],
    [/\bng\/mL\b/gi,  'nanograms per milliliter'],
    [/\bpg\/mL\b/gi,  'picograms per milliliter'],
    [/\bmEq\/L\b/gi,  'milliequivalents per liter'],
    [/\bU\/L\b/gi,    'units per liter'],
    [/\bg\/L\b/gi,    'grams per liter'],
    [/\bkcal\b/gi,    'kilocalories'],
    [/\bml\/kg\/min\b/gi, 'milliliters per kilogram per minute'],
  ]
  for (const [pattern, replacement] of unitMap) {
    text = text.replace(pattern, replacement)
  }

  // 4. Convert numbers to words
  text = numberToWords(text)

  // 5. Collapse extra whitespace
  text = text.replace(/\s{2,}/g, ' ').trim()

  return text
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
      // Text to speak — preprocessed for clean pronunciation
      elevenWs.send(JSON.stringify({ text: preprocessForVoice(msg.text.trim()) + ' ' }))
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
