import crypto from 'crypto'
import supabase from '../services/supabase.js'
import { buildRenderPayload } from '../services/renderPayloadMapper.js'
import { sendWhatsAppText, sendWhatsAppVideo } from '../services/whatsappService.js'

const RENDER_SERVICE_URL = process.env.RENDER_SERVICE_URL || 'https://meditrack-render.fly.dev'

export async function generateVideo(req, res) {
  const { id } = req.params
  const { userId } = req.user
  const { ageYears } = req.body

  const age = parseInt(ageYears, 10)
  if (!age || age < 18) {
    return res.status(400).json({ error: 'ageYears must be 18 or older' })
  }

  const { data: report, error: reportErr } = await supabase
    .from('reports')
    .select('id, report_title, report_date, structured_data, status, video_status, user_id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (reportErr || !report) {
    return res.status(404).json({ error: 'Report not found' })
  }

  if (report.status !== 'done') {
    return res.status(409).json({ error: 'Report must be fully analysed before generating a video' })
  }

  if (report.video_status === 'generating') {
    return res.status(409).json({ error: 'Video generation already in progress', videoStatus: 'generating' })
  }

  const { data: user } = await supabase
    .from('users')
    .select('name')
    .eq('id', userId)
    .single()

  const payload = buildRenderPayload({
    report,
    structuredData: report.structured_data ?? [],
    user: user ?? {},
    ageYears: age,
  })

  let renderRes
  try {
    renderRes = await fetch(`${RENDER_SERVICE_URL}/render`, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${process.env.RENDER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error('Render service unreachable:', err.message)
    return res.status(502).json({ error: 'render_service_unavailable' })
  }

  if (renderRes.status === 429) {
    const retryAfter = renderRes.headers.get('Retry-After') ?? '60'
    return res.status(429).json({ error: 'rate_limited', retryAfterSec: parseInt(retryAfter, 10) })
  }

  if (!renderRes.ok) {
    const body = await renderRes.json().catch(() => ({}))
    console.error('Render service rejected request:', renderRes.status, body)
    return res.status(502).json({ error: 'render_service_error', details: body })
  }

  const { jobId } = await renderRes.json()

  const { error: updateErr } = await supabase
    .from('reports')
    .update({
      video_status:       'generating',
      video_job_id:       jobId,
      video_requested_at: new Date().toISOString(),
      video_url:          null,
      video_error:        null,
    })
    .eq('id', id)

  if (updateErr) {
    console.error('Failed to persist video state:', updateErr.message)
    return res.status(500).json({ error: 'Failed to save video state', details: updateErr.message })
  }

  return res.json({ jobId, videoStatus: 'generating' })
}

export async function cancelVideo(req, res) {
  const { id } = req.params
  const { userId } = req.user

  const { data: report, error: reportErr } = await supabase
    .from('reports')
    .select('id, user_id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (reportErr || !report) {
    return res.status(404).json({ error: 'Report not found' })
  }

  const { error: updateErr } = await supabase
    .from('reports')
    .update({
      video_status:       'none',
      video_job_id:       null,
      video_url:          null,
      video_error:        null,
      video_requested_at: null,
    })
    .eq('id', id)

  if (updateErr) {
    console.error('Cancel video error:', updateErr.message)
    return res.status(500).json({ error: 'Failed to cancel video' })
  }

  return res.json({ cancelled: true })
}

function toPublicUrl(presignedUrl) {
  if (!process.env.R2_PUBLIC_URL || !presignedUrl) return null
  try {
    const url = new URL(presignedUrl)
    // R2 presigned URLs are path-style: /<bucket>/<object-key>
    // Strip the leading bucket segment to get just the object key
    const segments = url.pathname.replace(/^\//, '').split('/')
    const objectKey = segments.slice(1).join('/')
    return `${process.env.R2_PUBLIC_URL}/${objectKey}`
  } catch {
    return null
  }
}

export async function getVideoStatus(req, res) {
  const { id } = req.params
  const { userId } = req.user

  const { data: report, error } = await supabase
    .from('reports')
    .select('video_status, video_url, video_error')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !report) {
    return res.status(404).json({ error: 'Report not found' })
  }

  let videoUrl = report.video_url

  // Convert legacy presigned URLs to permanent public URLs
  if (report.video_status === 'ready' && videoUrl?.includes('X-Amz-Signature')) {
    const publicUrl = toPublicUrl(videoUrl)
    if (publicUrl) {
      videoUrl = publicUrl
      await supabase.from('reports').update({ video_url: publicUrl }).eq('id', id)
    }
  }

  return res.json({
    videoStatus: report.video_status,
    videoUrl,
    videoError:  report.video_error,
  })
}

async function notifyWhatsAppVideoReady(reportId) {
  const { data: report } = await supabase
    .from('reports')
    .select('whatsapp_wa_id, report_title, video_url')
    .eq('id', reportId)
    .maybeSingle()

  if (!report?.whatsapp_wa_id) return

  // Session language — falls back to 'en' if no session row exists
  const { data: session } = await supabase
    .from('whatsapp_sessions')
    .select('language')
    .eq('wa_id', report.whatsapp_wa_id)
    .maybeSingle()

  const lang    = session?.language ?? 'en'
  const caption = lang === 'hi'
    ? 'यह रहा आपका वीडियो सारांश! विस्तृत जानकारी के लिए meditrack.in पर जाएं।'
    : "Here's your video summary! Visit meditrack.in for detailed insights."

  // Attempt native video message first
  if (report.video_url) {
    try {
      await sendWhatsAppVideo(report.whatsapp_wa_id, report.video_url, caption)
      console.log('[WhatsApp] video sent natively to', report.whatsapp_wa_id, '| reportId:', reportId)
      return
    } catch (err) {
      console.warn('[WhatsApp] native video send failed, falling back to text:', err.message)
    }
  }

  // Fallback: text with link
  const title   = report.report_title ? `*${report.report_title}*` : 'Your report'
  const message = lang === 'hi'
    ? `${title} का वीडियो तैयार है! यहाँ देखें: ${report.video_url ?? 'meditrack.in'}`
    : `${title} video is ready! Watch it here: ${report.video_url ?? 'meditrack.in'}`
  await sendWhatsAppText(report.whatsapp_wa_id, message)
  console.log('[WhatsApp] video ready text notification sent to', report.whatsapp_wa_id, '| reportId:', reportId)
}

export async function handleVideoCallback(req, res) {
  const incoming = req.headers.authorization?.replace('Bearer ', '') ?? ''
  const expected = process.env.CALLBACK_SHARED_SECRET ?? ''

  // Hash both to equal length before timingSafeEqual (handles length-mismatch safely)
  const incomingHash = crypto.createHash('sha256').update(incoming).digest()
  const expectedHash  = crypto.createHash('sha256').update(expected).digest()
  const valid = incoming.length > 0 && crypto.timingSafeEqual(incomingHash, expectedHash)

  if (!valid) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const { reportId, status, videoUrl, completedAt, error: renderError } = req.body

  if (!reportId) {
    return res.status(400).json({ error: 'reportId required' })
  }

  if (status === 'completed') {
    const finalUrl = videoUrl?.includes('X-Amz-Signature') ? (toPublicUrl(videoUrl) ?? videoUrl) : videoUrl
    await supabase
      .from('reports')
      .update({
        video_status:       'ready',
        video_url:          finalUrl,
        video_error:        null,
        video_generated_at: completedAt ?? new Date().toISOString(),
      })
      .eq('id', reportId)
  } else if (status === 'failed') {
    await supabase
      .from('reports')
      .update({
        video_status: 'failed',
        video_error:  renderError ?? 'unknown_error',
        video_url:    null,
      })
      .eq('id', reportId)
  }

  res.json({ received: true })

  // ── WhatsApp video notification — isolated, fire-and-forget ─────────────
  // Fires AFTER the response is sent. Never throws, never blocks, never
  // affects the callback response above under any circumstances.
  if (status === 'completed') {
    notifyWhatsAppVideoReady(reportId).catch((err) => {
      console.error('[WhatsApp] video notification failed (non-fatal):', err.message)
    })
  }
}
