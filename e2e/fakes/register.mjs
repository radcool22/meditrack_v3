import { register } from 'node:module'
register('./hooks.mjs', import.meta.url)

// External HTTP APIs, answered locally. Requests to 127.0.0.1 pass through.
const realFetch = globalThis.fetch
const net = globalThis.__net ??= { graph: [], vision: [], eleven: [], videoDownloads: 0, transcript: 'what is my sugar level', mediaMime: {}, sarvam: [], sarvamMode: 'ok' }
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } })

globalThis.fetch = async (input, init = {}) => {
  const url = String(input instanceof Request ? input.url : input)
  const method = (init.method ?? 'GET').toUpperCase()
  if (url.startsWith('http://127.0.0.1')) return realFetch(input, init)

  if (url.startsWith('https://vision.googleapis.com/v1/images:annotate')) {
    net.vision.push('image')
    if (globalThis.__visionFail) return json({ error: { message: 'quota' } }, 429)
    return json({ responses: [{ fullTextAnnotation: { text: 'Haemoglobin 11.2 g/dL 13.0 - 17.0' } }] })
  }
  if (url.startsWith('https://vision.googleapis.com/v1/files:annotate')) {
    net.vision.push('pdf')
    return json({ responses: [{ responses: [{ fullTextAnnotation: { text: 'SCANNED PAGE Haemoglobin 11.2' } }] }] })
  }
  if (url.startsWith('https://api.elevenlabs.io/v1/speech-to-text')) { net.eleven.push('stt'); return json({ text: net.transcript }) }
  if (url.startsWith('https://api.elevenlabs.io/v1/text-to-speech/')) {
    net.eleven.push({ tts: JSON.parse(init.body) })
    return new Response(Buffer.from('ID3fakeaudio'), { status: 200 })
  }
  if (url.startsWith('https://graph.facebook.com/v21.0/')) {
    const path = url.slice('https://graph.facebook.com/v21.0/'.length)
    if (method === 'POST' && path.endsWith('/messages')) { net.graph.push(JSON.parse(init.body)); return json({ messages: [{ id: 'wamid.out' }] }) }
    if (method === 'POST' && path.endsWith('/media')) { net.graph.push({ upload: init.body.get('type') }); return json({ id: 'media-uploaded' }) }
    if (method === 'GET') return json({ url: `https://lookaside.example/${path}`, mime_type: net.mediaMime[path] ?? 'image/jpeg' })
  }
  if (url.startsWith('https://lookaside.example/')) return new Response(Buffer.from('\xFF\xD8\xFFfakebytes', 'latin1'), { status: 200 })
  if (url.startsWith('https://apps.sarvam.ai/api/outbounds/v1/orgs/')) {
    net.sarvam.push({ url, headers: init.headers, body: JSON.parse(init.body) })
    if (net.sarvamMode === 'down') throw new TypeError('fetch failed')
    if (net.sarvamMode === '422') return json({ detail: [{ loc: ['body', 'user_config', 'user_phone_number'], msg: 'invalid', input: 'Haemoglobin 11.2' }] }, 422)
    return json({ attempt_id: `att-${net.sarvam.length}` })
  }
  if (url.startsWith('https://videos.example/')) { net.videoDownloads++; return new Response(Buffer.from('fakemp4'), { status: 200 }) }
  throw new Error(`e2e: unexpected outbound request ${method} ${url}`)
}
