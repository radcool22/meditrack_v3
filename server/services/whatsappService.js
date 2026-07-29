import supabase from './supabase.js'
import { storeReportFile } from '../controllers/reportsController.js'
import { runAnalysisPipeline } from '../controllers/analysisController.js'
import { scheduleVideoRender } from './videoService.js'

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0'

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

export async function transcribeWhatsAppAudio(mediaId) {
  const { buffer, mimeType } = await downloadWhatsAppMedia(mediaId)

  const formData = new FormData()
  formData.append('model_id', 'scribe_v2')
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
  console.log('[WhatsApp] transcription result:', text?.slice(0, 100))
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
  // 1. Store file in Supabase Storage and create a pending report row
  const report = await storeReportFile(userId, fileBuffer, mimeType, fileName)
  console.log('[WhatsApp] report row created | id:', report.id)

  // 2. Mark as processing
  await supabase.from('reports').update({ status: 'processing' }).eq('id', report.id)

  // 3. Run OCR + GPT, passing the buffer we already have to skip re-downloading from storage
  const result = await runAnalysisPipeline(report.id, report.file_type, report.file_url, fileBuffer)
  console.log('[WhatsApp] analysis complete | reportId:', report.id)

  return { report, ...result }
}

export async function upsertWhatsAppSession(waId, updates) {
  const { error } = await supabase
    .from('whatsapp_sessions')
    .upsert({ wa_id: waId, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'wa_id' })
  if (error) console.error('[WhatsApp] session upsert error:', error.message)
}

export async function getWhatsAppSession(waId) {
  const { data, error } = await supabase
    .from('whatsapp_sessions')
    .select('user_id, current_report_id, state')
    .eq('wa_id', waId)
    .maybeSingle()
  if (error) console.error('[WhatsApp] getWhatsAppSession error:', error.message)
  return data ?? null
}

export async function triggerVideoFromWhatsApp(userId, waId) {
  // 1. Find which report to generate video for — prefer session's current_report_id
  const session = await getWhatsAppSession(waId)
  let reportId  = session?.current_report_id

  if (!reportId) {
    const { data: latest } = await supabase
      .from('reports')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'done')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    reportId = latest?.id
  }

  if (!reportId) throw Object.assign(new Error('No report available'), { code: 'no_report' })

  // 2. Stamp whatsapp_wa_id so the callback knows where to deliver the finished video
  await supabase.from('reports').update({ whatsapp_wa_id: waId }).eq('id', reportId)

  // 3. Trigger generation via the same render logic the website uses
  await scheduleVideoRender(userId, reportId, 25)

  // 4. Keep session up to date
  await upsertWhatsAppSession(waId, { current_report_id: reportId, state: 'idle' })

  return { reportId }
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

// Patterns that signal the user wants to switch to English
const ENGLISH_SWITCH = /\b(?:english|speak\s+in\s+english|talk\s+in\s+english|reply\s+in\s+english|switch\s+to\s+english|in\s+english|english\s+me(?:in?|h)?|english\s+please)\b/i

// Patterns that signal the user wants to switch to Hindi (Latin script + Devanagari)
const HINDI_SWITCH_LATIN      = /\b(?:hindi|speak\s+in\s+hindi|talk\s+in\s+hindi|reply\s+in\s+hindi|switch\s+to\s+hindi|in\s+hindi|hindi\s+me(?:in?|h)?|hindi\s+mein\s+baat\s+karo|hindi\s+please)\b/i
const HINDI_SWITCH_DEVANAGARI = /हिंदी|हिन्दी/

/**
 * Returns 'en', 'hi', or null.
 * Hindi is checked first so "hindi mein baat karo english nahi" resolves to 'hi'.
 */
export function detectLanguageSwitch(messageText) {
  if (!messageText) return null
  const t = messageText.trim()
  if (HINDI_SWITCH_LATIN.test(t) || HINDI_SWITCH_DEVANAGARI.test(t)) return 'hi'
  if (ENGLISH_SWITCH.test(t)) return 'en'
  return null
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
export async function triggerVideoForReport(userId, reportId, waId) {
  await supabase.from('reports').update({ whatsapp_wa_id: waId }).eq('id', reportId)
  await scheduleVideoRender(userId, reportId, 25)
  await upsertWhatsAppSession(waId, { current_report_id: reportId, state: 'idle' })
}
