import crypto from 'crypto'
import { requestCall, listCalls, getCall, buildAgentVariables, findUserByPhone, handleCallWebhook } from '../services/voiceService.js'

// requestCall error code → HTTP status. Codes go to the client as-is.
const ERROR_STATUS = {
  consent_required:   400,
  unsupported_number: 422,
  outside_hours:      422,
  not_found:          404,
  not_ready:          409,
  call_in_progress:   409,
  too_many_calls:     429,
  call_unavailable:   502,
}

// Constant-time compare of two secrets of any length.
function sameSecret(given, expected) {
  if (!given || !expected) return false
  const a = crypto.createHash('sha256').update(given).digest()
  const b = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(a, b)
}

export async function startCall(req, res) {
  const { reportId, language, consent } = req.body ?? {}
  try {
    const { callId } = await requestCall(req.user.userId, { reportId: reportId || null, language, consent: consent === true })
    return res.json({ callId, status: 'calling' })
  } catch (err) {
    const status = ERROR_STATUS[err.code]
    if (!status) {
      console.error('Start call error:', err.message)
      return res.status(500).json({ error: 'call_failed' })
    }
    return res.status(status).json({ error: err.code })
  }
}

export async function getCalls(req, res) {
  try {
    return res.json({ calls: await listCalls(req.user.userId) })
  } catch (err) {
    console.error('List calls error:', err.message)
    return res.status(503).json({ error: 'Could not load calls' })
  }
}

export async function getOneCall(req, res) {
  try {
    const call = await getCall(req.user.userId, req.params.id)
    if (!call) return res.status(404).json({ error: 'Call not found' })
    return res.json({ call })
  } catch (err) {
    console.error('Get call error:', err.message)
    return res.status(503).json({ error: 'Could not load call' })
  }
}

// Sarvam's on-start tool, before the agent says hello on an incoming call:
// who is calling, and what is in their reports. Authenticated with a bearer
// secret set on the tool in Sarvam's dashboard.
export async function callContext(req, res) {
  const token = req.headers.authorization?.replace(/^Bearer /, '')
  if (!sameSecret(token, process.env.VOICE_HOOK_SECRET)) return res.status(401).json({ error: 'unauthorized' })

  const phone = typeof req.body?.phone === 'string' ? req.body.phone.replace(/[^\d+]/g, '') : ''
  // No number: answer with an error so Sarvam keeps the variables it already
  // has (on an app-placed call we sent them with the call).
  if (!phone) return res.status(400).json({ error: 'phone required' })

  try {
    const user = await findUserByPhone(phone)
    return res.json(await buildAgentVariables(user))
  } catch (err) {
    console.error('Call context error:', err.message)
    return res.status(500).json({ error: 'context_failed' })
  }
}

// Sarvam's post-call webhook. Sarvam doesn't sign webhooks, so the URL carries a secret token.
export async function callWebhook(req, res) {
  if (!sameSecret(String(req.query.token ?? ''), process.env.VOICE_WEBHOOK_TOKEN)) return res.status(401).json({ error: 'unauthorized' })
  try {
    const applied = await handleCallWebhook(req.body ?? {})
    return res.json({ received: true, applied })
  } catch (err) {
    console.error('Call webhook error:', err.message)
    return res.status(500).json({ error: 'webhook_failed' })
  }
}
