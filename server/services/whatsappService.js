import crypto from 'crypto'
import supabase from './supabase.js'
import openai from './openai.js'
import { storeReportFile, MIME_TO_TYPE } from '../controllers/reportsController.js'
import { runAnalysisPipeline } from '../controllers/analysisController.js'
import { scheduleVideoRender } from './videoService.js'
import { getLanguage, isSupported } from '../config/languages.js'

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0'

let warnedNoAppSecret = false

/**
 * Verifies Meta's X-Hub-Signature-256 (HMAC-SHA256 of the raw body with the
 * app secret). Without WHATSAPP_APP_SECRET set, verification is skipped with a
 * one-time warning so the bot keeps working until the secret is configured.
 */
export function isValidWhatsAppSignature(rawBody, signatureHeader) {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret) {
    if (!warnedNoAppSecret) {
      console.warn('[WhatsApp] WHATSAPP_APP_SECRET not set — webhook signatures are NOT verified')
      warnedNoAppSecret = true
    }
    return true
  }
  if (!rawBody || typeof signatureHeader !== 'string' || !signatureHeader.startsWith('sha256=')) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest()
  const given    = Buffer.from(signatureHeader.slice(7), 'hex')
  return given.length === expected.length && crypto.timingSafeEqual(given, expected)
}

/** Translates an English text for the user's chosen language; English (or any failure) returns it unchanged. */
export async function translateForUser(text, languageCode) {
  if (!text || !isSupported(languageCode) || languageCode === 'en') return text
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.2,
      messages: [
        { role: 'system', content: `Translate the user's text for a patient. Keep it simple, at a Class 8 reading level, and keep every number exactly as written. ${getLanguage(languageCode).promptInstruction} Reply with the translation only.` },
        { role: 'user', content: text },
      ],
    })
    return completion.choices[0].message.content?.trim() || text
  } catch (err) {
    console.error('[WhatsApp] translation failed, sending English:', err.message)
    return text
  }
}

export async function sendWhatsAppText(toNumber, messageText) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken   = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) {
    console.error('[WhatsApp] sendWhatsAppText: missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN')
    return
  }

  const url  = `${GRAPH_API_BASE}/${phoneNumberId}/messages`
  const body = {
    messaging_product: 'whatsapp',
    to:                toNumber,
    type:              'text',
    text:              { body: messageText },
  }

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const responseText = await res.text()
    console.log('[WhatsApp] sendWhatsAppText →', toNumber, '| status:', res.status, '| response:', responseText)
  } catch (err) {
    console.error('[WhatsApp] sendWhatsAppText fetch error:', err.message)
  }
}

/**
 * @param {string} mediaId
 * @param {string|null} [languageCode] - user's chosen language code (en/hi/mr/gu/ml).
 *   Passed to Scribe v2 as a hint so incoming voice notes are transcribed in the
 *   right language. Unknown/missing codes resolve to English via getLanguage().
 *   NOTE: unlike the TTS calls, this adds a new form field for every language,
 *   including en/hi — there is no pre-existing "no hint" call to stay identical to.
 */
export async function transcribeWhatsAppAudio(mediaId, languageCode) {
  const { buffer, mimeType } = await downloadWhatsAppMedia(mediaId)

  const formData = new FormData()
  formData.append('model_id', 'scribe_v2')
  formData.append('language_code', getLanguage(languageCode).ttsLanguageCode)
  formData.append(
    'file',
    new Blob([buffer], { type: mimeType ?? 'audio/ogg' }),
    `audio.${(mimeType ?? 'audio/ogg').split('/')[1]}`
  )

  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method:  'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
    body:    formData,
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`ElevenLabs Scribe failed (${res.status}): ${errText}`)
  }

  const { text } = await res.json()
  console.log('[WhatsApp] transcription done | chars:', text?.length ?? 0)
  return text?.trim() ?? ''
}

export async function sendWhatsAppAudio(toNumber, audioBuffer) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken   = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) {
    throw new Error('[WhatsApp] sendWhatsAppAudio: missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN')
  }

  // Step 1: upload the MP3 buffer to WhatsApp's media endpoint to get a media ID
  const uploadForm = new FormData()
  uploadForm.append('messaging_product', 'whatsapp')
  uploadForm.append('type', 'audio/mpeg')
  uploadForm.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'voice.mp3')

  const uploadRes = await fetch(`${GRAPH_API_BASE}/${phoneNumberId}/media`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body:    uploadForm,
  })

  if (!uploadRes.ok) {
    const errText = await uploadRes.text()
    throw new Error(`WhatsApp media upload failed (${uploadRes.status}): ${errText}`)
  }

  const { id: mediaId } = await uploadRes.json()
  console.log('[WhatsApp] audio uploaded | mediaId:', mediaId)

  // Step 2: send as a WhatsApp audio message referencing the media ID
  const msgRes = await fetch(`${GRAPH_API_BASE}/${phoneNumberId}/messages`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      messaging_product: 'whatsapp',
      to:                toNumber,
      type:              'audio',
      audio:             { id: mediaId },
    }),
  })

  const responseText = await msgRes.text()
  console.log('[WhatsApp] sendWhatsAppAudio →', toNumber, '| status:', msgRes.status, '| response:', responseText)
  if (!msgRes.ok) throw new Error(`WhatsApp audio send failed (${msgRes.status}): ${responseText}`)
}

export async function sendWhatsAppVideo(toNumber, videoUrl, caption) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken   = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) {
    throw new Error('[WhatsApp] sendWhatsAppVideo: missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN')
  }

  // Step 1: download video bytes from R2
  const downloadRes = await fetch(videoUrl)
  if (!downloadRes.ok) {
    throw new Error(`[WhatsApp] sendWhatsAppVideo: R2 download failed (${downloadRes.status}) for ${videoUrl}`)
  }
  const videoBuffer = Buffer.from(await downloadRes.arrayBuffer())
  console.log('[WhatsApp] sendWhatsAppVideo: downloaded', videoBuffer.length, 'bytes from R2')

  // Step 2: upload to Meta media endpoint
  const uploadForm = new FormData()
  uploadForm.append('messaging_product', 'whatsapp')
  uploadForm.append('type', 'video/mp4')
  uploadForm.append('file', new Blob([videoBuffer], { type: 'video/mp4' }), 'video.mp4')

  const uploadRes = await fetch(`${GRAPH_API_BASE}/${phoneNumberId}/media`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body:    uploadForm,
  })

  if (!uploadRes.ok) {
    const errText = await uploadRes.text()
    throw new Error(`[WhatsApp] sendWhatsAppVideo: Meta media upload failed (${uploadRes.status}): ${errText}`)
  }

  const { id: mediaId } = await uploadRes.json()
  console.log('[WhatsApp] sendWhatsAppVideo: uploaded | mediaId:', mediaId)

  // Step 3: send video message referencing the media ID
  const msgRes = await fetch(`${GRAPH_API_BASE}/${phoneNumberId}/messages`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      messaging_product: 'whatsapp',
      to:                toNumber,
      type:              'video',
      video:             { id: mediaId, caption },
    }),
  })

  const responseText = await msgRes.text()
  console.log('[WhatsApp] sendWhatsAppVideo →', toNumber, '| status:', msgRes.status, '| response:', responseText)

  if (!msgRes.ok) throw new Error(`[WhatsApp] sendWhatsAppVideo: message send failed (${msgRes.status}): ${responseText}`)
}

// wa_id from Meta webhooks has no leading '+' (e.g. '919876543210')
// The users table stores phone_number as '+919876543210'
export async function findUserByWhatsAppNumber(waId) {
  const phoneNumber = `+${waId}`

  const { data: user, error } = await supabase
    .from('users')
    .select('id, phone_number, name, language_preference')
    .eq('phone_number', phoneNumber)
    .maybeSingle()

  if (error) {
    console.error('[WhatsApp] findUserByWhatsAppNumber error:', error.message)
    return null
  }

  return user ?? null
}

/**
 * Persists the user's explicit language choice to users.language_preference,
 * so it survives independent of any single WhatsApp session row.
 * Requires the users_language_preference_check constraint to allow the code —
 * see server/migrations/widen_language_preference.sql for mr/gu/ml.
 */
export async function setUserLanguagePreference(userId, languageCode) {
  const { error } = await supabase
    .from('users')
    .update({ language_preference: languageCode })
    .eq('id', userId)
  if (error) console.error('[WhatsApp] setUserLanguagePreference error:', error.message)
}

export async function downloadWhatsAppMedia(mediaId) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  if (!accessToken) throw new Error('WHATSAPP_ACCESS_TOKEN not set')

  // Step 1: retrieve the temporary download URL from the Graph API
  console.log('[WhatsApp] fetching media info for id:', mediaId)
  const infoRes = await fetch(`${GRAPH_API_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!infoRes.ok) {
    const body = await infoRes.text()
    throw new Error(`Media info fetch failed (${infoRes.status}): ${body}`)
  }

  const { url, mime_type: mimeType } = await infoRes.json()
  console.log('[WhatsApp] media url received | mime_type:', mimeType)

  // Step 2: download the actual bytes — URL expires in ~5 minutes, so do this immediately
  const fileRes = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!fileRes.ok) throw new Error(`Media download failed (${fileRes.status})`)

  const buffer = Buffer.from(await fileRes.arrayBuffer())
  console.log('[WhatsApp] media downloaded | bytes:', buffer.length, '| mime:', mimeType)

  return { buffer, mimeType }
}

export async function processReportFromBuffer(userId, fileBuffer, mimeType, fileName) {
  // 0. Same formats as the website — anything else would fail the DB check after
  //    the file was already uploaded, leaving an orphan in storage.
  if (!MIME_TO_TYPE[mimeType]) {
    throw Object.assign(new Error(`Unsupported file type: ${mimeType}`), { code: 'unsupported_type' })
  }

  // 1. Store file in Supabase Storage and create a pending report row
  const report = await storeReportFile(userId, fileBuffer, mimeType, fileName)
  console.log('[WhatsApp] report row created | id:', report.id)

  // 2. Mark as processing
  await supabase.from('reports').update({ status: 'processing' }).eq('id', report.id)

  // 3. Run OCR + GPT, passing the buffer we already have to skip re-downloading from storage
  let result
  try {
    result = await runAnalysisPipeline(report.id, report.file_type, report.file_url, fileBuffer)
  } catch (err) {
    await supabase.from('reports').update({ status: 'failed' }).eq('id', report.id)
    throw err
  }
  console.log('[WhatsApp] analysis complete | reportId:', report.id)

  return { report, ...result }
}

export async function upsertWhatsAppSession(waId, updates) {
  const { error } = await supabase
    .from('whatsapp_sessions')
    .upsert({ wa_id: waId, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'wa_id' })
  if (error) console.error('[WhatsApp] session upsert error:', error.message)
}

// ── Phase H: conversation state helpers ──────────────────────────────────────
// These are not wired into the message handler yet. Phase H will use them.

const SESSION_COLUMNS = 'wa_id, user_id, current_report_id, state, language, pending_action, pending_data, recent_history'

/**
 * Returns the existing session row for waId, or creates one with sensible defaults.
 * Read-first: the common path (existing session) hits only one SELECT.
 */
export async function getOrCreateSession(waId, userId) {
  const { data: existing } = await supabase
    .from('whatsapp_sessions')
    .select(SESSION_COLUMNS)
    .eq('wa_id', waId)
    .maybeSingle()

  if (existing) return existing

  // First message from this number — upsert handles the race if two messages arrive simultaneously
  const { data: created, error } = await supabase
    .from('whatsapp_sessions')
    .upsert(
      { wa_id: waId, user_id: userId, updated_at: new Date().toISOString() },
      { onConflict: 'wa_id' }
    )
    .select(SESSION_COLUMNS)
    .single()

  if (error) {
    console.error('[WhatsApp] getOrCreateSession error:', error.message)
    return { wa_id: waId, user_id: userId, state: 'idle', language: 'en', pending_action: null, pending_data: null, recent_history: null }
  }

  return created
}

/**
 * Updates any subset of session columns (language, pending_action, pending_data,
 * recent_history, current_report_id, state). Always touches updated_at.
 */
export async function updateSessionState(waId, updates) {
  const { error } = await supabase
    .from('whatsapp_sessions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('wa_id', waId)
  if (error) console.error('[WhatsApp] updateSessionState error:', error.message)
}

// Words for each language, Latin and native script. Order matters: non-English
// first, so "hindi mein baat karo, english nahi" resolves to Hindi.
const LANGUAGE_WORDS = [
  { code: 'hi', latin: 'hindi',     native: ['हिंदी', 'हिन्दी'] },
  { code: 'mr', latin: 'marathi',   native: ['मराठी'] },
  { code: 'gu', latin: 'gujarati',  native: ['ગુજરાતી'] },
  { code: 'ml', latin: 'malayalam', native: ['മലയാളം'] },
  { code: 'en', latin: 'english',   native: [] },
]

// Only an explicit request switches language. Merely mentioning one ("my Hindi
// report", "I'm from a Gujarati family") must not — the switch is saved to the
// user's profile.
function requestsLanguage(text, { latin, native }) {
  const L = latin
  const latinPatterns = [
    // "reply in hindi", "switch to hindi", "change language to hindi", "explain my report in hindi"
    new RegExp(String.raw`\b(?:speak|talk|reply|respond|answer|write|chat|explain|switch|change)\b(?:\s+\S+){0,3}?\s+(?:in|to)\s+${L}\b`, 'i'),
    // "hindi mein baat karo", "hindi me batao"
    new RegExp(String.raw`\b${L}\s+(?:me|mein|mai|main|men)\s+(?:baat|bol|bata|jawab|samjha|kah|likh|reply|explain)`, 'i'),
    // "... in hindi" / "... in hindi please" at the end of the message
    new RegExp(String.raw`\bin\s+${L}(?:\s+please)?\s*[.!?]*\s*$`, 'i'),
    // the whole message is the language: "hindi", "hindi please", "in hindi"
    new RegExp(String.raw`^\s*(?:in\s+)?${L}(?:\s+(?:please|pls|me|mein|language))?\s*[.!?]*\s*$`, 'i'),
  ]
  if (latinPatterns.some((re) => re.test(text))) return true
  return native.some((word) =>
    // "हिंदी", "हिंदी में" alone, or "हिंदी में बात करो / बताओ / समझाओ"
    new RegExp(`^\\s*${word}\\s*(?:में|मे)?\\s*[।.!?]*\\s*$`).test(text) ||
    new RegExp(`${word}\\s*(?:में|मे)\\s*(?:बात|बोल|बता|जवाब|समझा)`).test(text))
}

/** Returns a supported language code, or null if the message doesn't ask to switch. */
export function detectLanguageSwitch(messageText) {
  if (!messageText) return null
  const t = messageText.trim()
  const match = LANGUAGE_WORDS.find((lang) => requestsLanguage(t, lang))
  return match?.code ?? null
}

const MAX_HISTORY_TURNS = 6

/**
 * Returns a new recent_history array with the new turn appended and capped at
 * MAX_HISTORY_TURNS entries. Does NOT write to DB — caller must persist via
 * updateSessionState(waId, { recent_history: newHistory }).
 *
 * @param {object|null} session  - Current session row (may have null recent_history)
 * @param {'user'|'assistant'} role
 * @param {string} text          - Message content
 * @returns {Array<{role: string, content: string}>}
 */
export function appendHistory(session, role, text) {
  const existing = Array.isArray(session?.recent_history) ? session.recent_history : []
  return [...existing, { role, content: text }].slice(-MAX_HISTORY_TURNS)
}

/**
 * Returns all done reports for a user, ordered by report_date descending (nulls last).
 */
export async function getDoneReports(userId) {
  const { data, error } = await supabase
    .from('reports')
    .select('id, report_title, report_date')
    .eq('user_id', userId)
    .eq('status', 'done')
    .order('report_date', { ascending: false, nullsFirst: false })
  if (error) console.error('[WhatsApp] getDoneReports error:', error.message)
  return data ?? []
}

/**
 * Triggers video for an already-known reportId — no report lookup needed.
 * Used when the user has explicitly selected from a list.
 */
export async function triggerVideoForReport(userId, reportId, waId, ageYears) {
  await scheduleVideoRender(userId, reportId, ageYears)
  // Stamped only once the render is scheduled, so the callback knows where to deliver.
  await supabase.from('reports').update({ whatsapp_wa_id: waId }).eq('id', reportId)
  await upsertWhatsAppSession(waId, { current_report_id: reportId, state: 'idle' })
}
