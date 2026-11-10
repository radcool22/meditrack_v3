import axios from './axios'

// Phone calls with the MediTrack voice agent ("Call me").

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } })

// Resolves { ok: true, callId } once Sarvam is dialling, or { ok: false, code }
// with the server's error code for callErrorMessage().
export async function requestCall({ reportId = null, language, consent = false }, token) {
  try {
    const { data } = await axios.post('/api/voice/call', { reportId, language, consent }, auth(token))
    announceCallsChanged()
    return { ok: true, callId: data.callId, from: data.from }
  } catch (err) {
    return { ok: false, code: err.response?.data?.error ?? 'network' }
  }
}

export async function fetchCalls(token) {
  const { data } = await axios.get('/api/voice/calls', auth(token))
  return data.calls ?? []
}

export async function fetchCall(callId, token) {
  const { data } = await axios.get(`/api/voice/calls/${callId}`, auth(token))
  return data.call
}

// Call start error codes → what the user reads.
const MESSAGES = {
  unsupported_number: 'Phone calls work with Indian (+91) numbers for now. You can still ask on WhatsApp or in the chat.',
  outside_hours:      'MediTrack calls between 8 am and 9:30 pm, India time. Please try again then — WhatsApp works any time.',
  call_in_progress:   "We're already calling you. Please pick up your phone.",
  too_many_calls:     "You've had a few calls in a short time. Please try again in a little while.",
  not_ready:          'This report is still being analysed. Please try again in a moment.',
  not_found:          "We couldn't find that report.",
}

const FALLBACK = "Sorry, we couldn't start the call just now. Please try again in a minute."

export function callErrorMessage(code) {
  return MESSAGES[code] ?? FALLBACK
}

// Why a call that was placed didn't happen → what the user reads.
export function callOutcomeMessage(call) {
  if (call.status === 'no_answer') return "You didn't pick up — no problem. We can call again whenever you're ready."
  if (call.status === 'busy') return 'Your line was busy. Please try again in a minute.'
  if (/NDNC|DND/i.test(call.failure_reason ?? '')) {
    return 'The call was blocked because your number is on the Do Not Disturb list. You can still ask on WhatsApp or in the chat.'
  }
  return "The call didn't go through. Please try again."
}

// Fired when a call starts or ends, so the call history refreshes itself.
export const CALLS_CHANGED_EVENT = 'mt:calls-changed'

export function announceCallsChanged() {
  window.dispatchEvent(new CustomEvent(CALLS_CHANGED_EVENT))
}

// "Call me" links from meditrack.in arrive as ?call=1. The user may have to log
// in first, so the intent is kept for the session until the dashboard uses it.
const INTENT_KEY = 'mt_call_intent'

export function rememberCallIntent() {
  try {
    if (new URLSearchParams(window.location.search).get('call') === '1') sessionStorage.setItem(INTENT_KEY, '1')
  } catch {}
}

export function hasCallIntent() {
  try { return sessionStorage.getItem(INTENT_KEY) === '1' } catch { return false }
}

export function takeCallIntent() {
  const had = hasCallIntent()
  try { sessionStorage.removeItem(INTENT_KEY) } catch {}
  return had
}

export function formatPhone(phone) {
  if (!phone) return ''
  const m = phone.match(/^\+91(\d{5})(\d{5})$/)
  return m ? `+91 ${m[1]} ${m[2]}` : phone
}

export function formatDuration(sec) {
  if (!sec) return ''
  const s = Math.round(sec)
  return s < 60 ? `${s} sec` : `${Math.floor(s / 60)} min ${s % 60 ? `${s % 60} sec` : ''}`.trim()
}
