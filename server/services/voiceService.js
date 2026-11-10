import supabase from './supabase.js'
import openai from './openai.js'
import { getLanguage, isSupported } from '../config/languages.js'
import { sendWhatsAppText } from './whatsappService.js'

// Phone calls with the MediTrack voice agent, hosted on Sarvam Voice Agents.
// Sarvam runs the conversation; we hand it the caller's reports as agent
// variables and receive the transcript in a webhook when the call ends.

const SARVAM_BASE = 'https://apps.sarvam.ai/api/outbounds/v1'

// Our language codes → Sarvam's initial_language_name values.
const SARVAM_LANGUAGE = { en: 'English', hi: 'Hindi', mr: 'Marathi', gu: 'Gujarati', ml: 'Malayalam' }

export const CALLS_PER_HOUR = 3
export const CALLS_PER_DAY = 10
// No webhook within this window means the call was lost; the user may call again.
export const STALE_CALLING_MS = 15 * 60 * 1000
// "Call me" is only offered during sociable hours, India time ("HH:MM-HH:MM").
function callWindow() {
  const m = (process.env.VOICE_CALL_HOURS ?? '08:00-21:30').match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/)
  if (!m) return { start: 8 * 60, end: 21 * 60 + 30 }
  return { start: +m[1] * 60 + +m[2], end: +m[3] * 60 + +m[4] }
}

const MAX_REPORTS = 5
const MAX_CONTEXT_CHARS = 6000

function voiceError(code) {
  return Object.assign(new Error(code), { code })
}

function istMinutes(now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60 * 1000)
  return ist.getUTCHours() * 60 + ist.getUTCMinutes()
}

export function withinCallingHours(now = new Date()) {
  const m = istMinutes(now)
  const { start, end } = callWindow()
  return m >= start && m < end
}

// Numbers we can dial from an Indian line. Overridable for testing from abroad.
function canDial(phone) {
  const prefixes = (process.env.VOICE_ALLOWED_PREFIXES ?? '+91').split(',').map((p) => p.trim()).filter(Boolean)
  return prefixes.some((p) => phone.startsWith(p))
}

function dateLabel(r) {
  const d = r.report_date ?? r.uploaded_at
  const label = new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  return r.report_date ? label : `uploaded ${label}`
}

async function latestAnalysis(reportId) {
  const { data } = await supabase
    .from('report_analyses')
    .select('summary, abnormal_values, suggestions')
    .eq('report_id', reportId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

// The agent only relays what MediTrack's analysis already says — it is given
// plain-language findings, not raw numbers to reason about from scratch.
function reportBlock(r, analysis) {
  const lines = [`Report: ${r.report_title || r.file_name} (${dateLabel(r)})`]
  if (analysis?.summary) lines.push(`Summary: ${analysis.summary}`)
  const abnormal = analysis?.abnormal_values ?? []
  if (abnormal.length) {
    lines.push('Outside the normal range:')
    for (const a of abnormal) lines.push(`- ${a.test}: ${a.value} (normal ${a.normal_range || 'not printed'}). ${a.plain_explanation ?? ''}`.trim())
  } else {
    lines.push('Outside the normal range: nothing.')
  }
  const tests = Array.isArray(r.structured_data) ? r.structured_data : []
  const normal = tests.filter((t) => !abnormal.some((a) => a.test === t.test)).map((t) => `${t.test} ${t.value}${t.unit ? ' ' + t.unit : ''}`)
  if (normal.length) lines.push(`Other values: ${normal.join('; ')}.`)
  if (analysis?.suggestions?.length) lines.push(`Suggestions: ${analysis.suggestions.join(' ')}`)
  return lines.join('\n')
}

/**
 * Agent variables for one caller. Every value is a string (Sarvam's variables
 * are strings). An unknown number gets registered = "no" and nothing else.
 */
export async function buildAgentVariables(user, focusReportId = null, language = user?.language_preference) {
  if (!user) return { registered: 'no', first_name: '', reports: '', report_count: '0', focus_report: '', preferred_language: 'English' }

  const { data: reports } = await supabase
    .from('reports')
    .select('id, file_name, report_title, report_date, uploaded_at, structured_data')
    .eq('user_id', user.id)
    .eq('status', 'done')
    .order('uploaded_at', { ascending: false })
    .limit(MAX_REPORTS)

  let rows = reports ?? []
  // The report the user tapped "Call me about this" on always goes in, first.
  if (focusReportId && !rows.some((r) => r.id === focusReportId)) {
    const { data: focusRow } = await supabase
      .from('reports')
      .select('id, file_name, report_title, report_date, uploaded_at, structured_data')
      .eq('id', focusReportId)
      .eq('user_id', user.id)
      .eq('status', 'done')
      .maybeSingle()
    if (focusRow) rows = [focusRow, ...rows.slice(0, MAX_REPORTS - 1)]
  } else if (focusReportId) {
    rows = [rows.find((r) => r.id === focusReportId), ...rows.filter((r) => r.id !== focusReportId)]
  }
  const blocks = await Promise.all(rows.map(async (r) => reportBlock(r, await latestAnalysis(r.id))))

  // Newest first, so if the text has to be cut, the oldest report goes.
  let text = ''
  for (const b of blocks) {
    if ((text + '\n\n' + b).length > MAX_CONTEXT_CHARS) break
    text = text ? `${text}\n\n${b}` : b
  }

  const focus = focusReportId ? rows.find((r) => r.id === focusReportId) : null
  return {
    registered:   'yes',
    first_name:   user.name?.trim().split(/\s+/)[0] ?? '',
    reports:      text || 'No analysed reports yet.',
    report_count: String(rows.length),
    focus_report: focus ? `${focus.report_title || focus.file_name} (${dateLabel(focus)})` : '',
    preferred_language: SARVAM_LANGUAGE[language] ?? 'English',
  }
}

export async function findUserByPhone(phone) {
  if (!phone) return null
  const normalised = phone.startsWith('+') ? phone : `+${phone}`
  const { data } = await supabase
    .from('users')
    .select('id, phone_number, name, language_preference, voice_consent_at')
    .eq('phone_number', normalised)
    .maybeSingle()
  return data ?? null
}

function settleStaleCall(call) {
  if (call.status !== 'calling' || Date.now() - new Date(call.created_at).getTime() < STALE_CALLING_MS) return call
  return { ...call, status: 'failed', failure_reason: call.failure_reason ?? 'no_result' }
}

export async function listCalls(userId) {
  const { data, error } = await supabase
    .from('voice_calls')
    .select('id, report_id, direction, language, status, duration_sec, failure_reason, summary, urgent, created_at, ended_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []).map(settleStaleCall)
}

export async function getCall(userId, callId) {
  const { data, error } = await supabase
    .from('voice_calls')
    .select('id, report_id, direction, language, status, duration_sec, failure_reason, summary, urgent, transcript, created_at, ended_at')
    .eq('id', callId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data ? settleStaleCall(data) : null
}

async function sarvamOutbound(body) {
  const { SARVAM_API_KEY, SARVAM_ORG_ID, SARVAM_WORKSPACE_ID } = process.env
  const url = `${SARVAM_BASE}/orgs/${SARVAM_ORG_ID}/workspaces/${SARVAM_WORKSPACE_ID}/outbounds`
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': SARVAM_API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
  } catch (err) {
    console.error('[Voice] Sarvam unreachable:', err.message)
    throw voiceError('call_unavailable')
  }
  const text = await res.text()
  if (!res.ok) {
    // Validation errors can echo the request (report text) back — log only where it failed.
    let where = ''
    try { where = (JSON.parse(text).detail ?? []).map((d) => `${(d.loc ?? []).join('.')}: ${d.msg}`).join('; ') } catch {}
    console.error('[Voice] Sarvam outbound failed:', res.status, where.slice(0, 300))
    throw voiceError('call_unavailable')
  }
  const attemptId = JSON.parse(text).attempt_id
  if (!attemptId) throw voiceError('call_unavailable')
  return attemptId
}

/**
 * "Call me": Sarvam rings the user's registered number and the agent talks
 * them through their reports. Throws coded errors the client maps to messages.
 */
export async function requestCall(userId, { reportId = null, language, consent = false } = {}) {
  for (const k of ['SARVAM_API_KEY', 'SARVAM_ORG_ID', 'SARVAM_WORKSPACE_ID', 'SARVAM_APP_ID', 'SARVAM_CONNECTION_ID', 'SARVAM_AGENT_NUMBER', 'VOICE_WEBHOOK_TOKEN']) {
    if (!process.env[k]) { console.error(`[Voice] ${k} not set`); throw voiceError('call_unavailable') }
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('id, phone_number, name, language_preference, voice_consent_at')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!user) throw voiceError('not_found')

  if (!user.voice_consent_at) {
    if (!consent) throw voiceError('consent_required')
    const consentAt = new Date().toISOString()
    await supabase.from('users').update({ voice_consent_at: consentAt }).eq('id', userId)
    user.voice_consent_at = consentAt
  }
  if (!canDial(user.phone_number)) throw voiceError('unsupported_number')
  if (!withinCallingHours()) throw voiceError('outside_hours')

  if (reportId) {
    const { data: report } = await supabase.from('reports').select('id, status').eq('id', reportId).eq('user_id', userId).maybeSingle()
    if (!report) throw voiceError('not_found')
    if (report.status !== 'done') throw voiceError('not_ready')
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recent, error: recentErr } = await supabase
    .from('voice_calls')
    .select('id, status, failure_reason, created_at')
    .eq('user_id', userId)
    .eq('direction', 'outbound')
    .gt('created_at', dayAgo)
  if (recentErr) throw recentErr
  // Calls that never left our side (Sarvam refused or was down) don't count.
  const calls = (recent ?? []).filter((c) => c.failure_reason !== 'not_started').map(settleStaleCall)
  if (calls.some((c) => c.status === 'calling')) throw voiceError('call_in_progress')
  const hourAgo = Date.now() - 60 * 60 * 1000
  if (calls.filter((c) => new Date(c.created_at).getTime() > hourAgo).length >= CALLS_PER_HOUR) throw voiceError('too_many_calls')
  if (calls.length >= CALLS_PER_DAY) throw voiceError('too_many_calls')

  const lang = isSupported(language) ? language : (isSupported(user.language_preference) ? user.language_preference : 'en')

  const { data: call, error: insertErr } = await supabase
    .from('voice_calls')
    .insert({ user_id: userId, report_id: reportId, direction: 'outbound', phone_number: user.phone_number, language: lang, status: 'calling' })
    .select('id')
    .single()
  if (insertErr) throw insertErr

  let attemptId
  try {
    attemptId = await sarvamOutbound({
      app_config: {
        app_id:      process.env.SARVAM_APP_ID,
        app_version: Number(process.env.SARVAM_APP_VERSION ?? 1),
        connection_config: {
          connection_id:      process.env.SARVAM_CONNECTION_ID,
          agent_phone_number: process.env.SARVAM_AGENT_NUMBER,
        },
        agent_variables: await buildAgentVariables(user, reportId, lang),
        app_overrides:   { initial_language_name: SARVAM_LANGUAGE[lang] },
      },
      user_config:    { user_phone_number: user.phone_number },
      webhook_config: {
        url:      `${process.env.APP_BASE_URL}/api/voice/webhook?token=${encodeURIComponent(process.env.VOICE_WEBHOOK_TOKEN)}`,
        metadata: { call_id: call.id },
      },
    })
  } catch (err) {
    await supabase.from('voice_calls').update({ status: 'failed', failure_reason: 'not_started', ended_at: new Date().toISOString() }).eq('id', call.id)
    throw err
  }

  await supabase.from('voice_calls').update({ sarvam_attempt_id: attemptId }).eq('id', call.id)
  console.log('[Voice] outbound call started | call:', call.id)
  return { callId: call.id }
}

// ── After the call ──────────────────────────────────────────────────────────

const STATUS = { connected: 'completed', no_answer: 'no_answer', busy: 'busy', failed: 'failed' }

function cleanTranscript(raw) {
  if (!Array.isArray(raw)) return null
  return raw
    .filter((t) => t && (t.role === 'agent' || t.role === 'user'))
    .map((t) => ({ role: t.role, text: String(t.indic_text || t.en_text || '').slice(0, 4000) }))
    .filter((t) => t.text)
}

async function summariseCall(rawTranscript, language) {
  const lines = (rawTranscript ?? [])
    .filter((t) => t?.en_text && (t.role === 'agent' || t.role === 'user'))
    .map((t) => `${t.role === 'agent' ? 'MediTrack' : 'Patient'}: ${t.en_text}`)
  if (!lines.length) return null

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Summarise a phone call between MediTrack (a health assistant explaining lab reports) and a patient.
Return JSON: {"summary": string, "urgent": boolean}.
- summary: 2 to 4 short sentences for the patient: what they asked, what they were told, and any next step such as seeing a doctor. Class 8 reading level, no jargon, no new medical advice.
- urgent: true only if the patient described symptoms that need a doctor soon (for example chest pain, trouble breathing, fainting, very high sugar with symptoms).
${getLanguage(language).promptInstruction}`,
      },
      { role: 'user', content: lines.join('\n').slice(0, 12000) },
    ],
  })
  const out = JSON.parse(completion.choices[0].message.content)
  return { summary: typeof out.summary === 'string' ? out.summary.trim() : null, urgent: out.urgent === true }
}

const SUMMARY_LEAD = {
  en: 'Summary of your MediTrack call:',
  hi: 'आपकी MediTrack कॉल का सारांश:',
  mr: 'तुमच्या MediTrack कॉलचा सारांश:',
  gu: 'તમારા MediTrack કૉલનો સારાંશ:',
  ml: 'നിങ്ങളുടെ MediTrack കോളിന്റെ സംഗ്രഹം:',
}

// Summary + WhatsApp copy. Runs after the webhook has been answered; failures
// are logged and leave the call row without a summary, never break anything.
async function finishCall(callId, rawTranscript) {
  const { data: call } = await supabase.from('voice_calls').select('id, language, phone_number, user_id').eq('id', callId).maybeSingle()
  if (!call?.user_id) return

  const result = await summariseCall(rawTranscript, call.language)
  if (!result?.summary) return
  await supabase.from('voice_calls').update({ summary: result.summary, urgent: result.urgent }).eq('id', callId)

  // Only reaches users who messaged MediTrack on WhatsApp in the last 24 h (Meta's rule).
  try {
    await sendWhatsAppText(call.phone_number.replace(/^\+/, ''), `${SUMMARY_LEAD[call.language] ?? SUMMARY_LEAD.en}\n\n${result.summary}`)
    await supabase.from('voice_calls').update({ whatsapp_sent: true }).eq('id', callId)
  } catch (err) {
    console.warn('[Voice] WhatsApp summary not sent:', err.message.slice(0, 120))
  }
}

/**
 * Sarvam's post-call webhook. Two shapes arrive here:
 * - outbound (our "Call me"): attempt_id + status, metadata.call_id echoed back
 * - inbound deployment: interaction_id + user_phone_number, no status
 * Returns true when a row was created or updated. Safe to receive twice.
 */
export async function handleCallWebhook(body) {
  const transcript = cleanTranscript(body.interaction_transcript)
  const endedAt = body.end_datetime ?? new Date().toISOString()
  let callId = null

  if (body.attempt_id) {
    let { data: call } = await supabase.from('voice_calls').select('id, status').eq('sarvam_attempt_id', body.attempt_id).maybeSingle()
    // The webhook can beat our own attempt_id write; metadata.call_id still identifies the row.
    if (!call && body.webhook_config?.metadata?.call_id) {
      ;({ data: call } = await supabase.from('voice_calls').select('id, status').eq('id', body.webhook_config.metadata.call_id).maybeSingle())
    }
    if (!call) return false
    if (call.status !== 'calling') return true // already processed (Sarvam retry)

    const status = STATUS[body.status] ?? 'failed'
    await supabase.from('voice_calls').update({
      status,
      sarvam_attempt_id: body.attempt_id,
      interaction_id:    body.interaction_id ?? null,
      duration_sec:      body.duration ?? null,
      failure_reason:    status === 'completed' ? null : String(body.failure_reason ?? body.status ?? 'unknown').slice(0, 200),
      transcript,
      ended_at:          endedAt,
    }).eq('id', call.id)
    if (status === 'completed') callId = call.id
  } else if (body.interaction_id) {
    const { data: existing } = await supabase.from('voice_calls').select('id').eq('interaction_id', body.interaction_id).maybeSingle()
    if (existing) return true

    const user = await findUserByPhone(body.user_phone_number)
    const lang = Object.entries(SARVAM_LANGUAGE).find(([, name]) => name === body.final_agent_variables?.language_name)?.[0]
      ?? user?.language_preference ?? 'en'
    const { data: call, error } = await supabase.from('voice_calls').insert({
      user_id:        user?.id ?? null,
      direction:      'inbound',
      phone_number:   body.user_phone_number ?? 'unknown',
      language:       isSupported(lang) ? lang : 'en',
      status:         'completed',
      interaction_id: body.interaction_id,
      duration_sec:   body.duration ?? null,
      transcript,
      created_at:     body.start_datetime ?? new Date().toISOString(),
      ended_at:       endedAt,
    }).select('id').single()
    if (error) {
      if (/duplicate|unique/i.test(error.message)) return true
      throw error
    }
    callId = call.id
  } else {
    return false
  }

  if (callId) {
    finishCall(callId, body.interaction_transcript).catch((err) => console.error('[Voice] summary failed:', err.message))
  }
  return true
}
