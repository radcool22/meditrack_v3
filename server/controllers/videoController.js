import crypto from 'crypto'
import supabase from '../services/supabase.js'
import { scheduleVideoRender } from '../services/videoService.js'
import { sendWhatsAppText, sendWhatsAppVideo } from '../services/whatsappService.js'

// scheduleVideoRender error code → HTTP status. Codes go to the client as-is
// so it can show the right message.
const ERROR_STATUS = {
  invalid_age:         400,
  specialist_required: 422,
  no_numeric_values:   422,
  not_found:           404,
  not_ready:           409,
  already_generating:  409,
  rate_limited:        429,
  render_unavailable:  502,
  render_error:        502,
}

export async function generateVideo(req, res) {
  const { id } = req.params
  const { userId } = req.user

  try {
    const { jobId } = await scheduleVideoRender(userId, id, req.body?.ageYears)
    return res.json({ jobId, videoStatus: 'generating' })
  } catch (err) {
    const status = ERROR_STATUS[err.code]
    if (!status) {
      console.error('Generate video error:', err.message)
      return res.status(500).json({ error: 'video_failed' })
    }
    return res.status(status).json({
      error: err.code,
      ...(err.retryAfterSec ? { retryAfterSec: err.retryAfterSec } : {}),
    })
  }
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

  // Clearing video_job_id is what makes the cancel stick: the render may still
  // finish, but its callback no longer matches and is ignored.
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
    .select('video_status, video_url, video_error, video_requested_at')
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
    videoStatus:      report.video_status,
    videoUrl,
    videoError:       report.video_error,
    videoRequestedAt: report.video_requested_at,
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
      console.log('[WhatsApp] video sent natively | reportId:', reportId)
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
  console.log('[WhatsApp] video ready text notification sent | reportId:', reportId)
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

  const { jobId, reportId, status, videoUrl, completedAt, error: renderError } = req.body ?? {}

  if (!reportId || !jobId) {
    return res.status(400).json({ error: 'reportId and jobId required' })
  }

  let update = null
  if (status === 'completed') {
    update = {
      video_status:       'ready',
      video_url:          videoUrl?.includes('X-Amz-Signature') ? (toPublicUrl(videoUrl) ?? videoUrl) : videoUrl,
      video_error:        null,
      video_generated_at: completedAt ?? new Date().toISOString(),
    }
  } else if (status === 'failed') {
    update = {
      video_status: 'failed',
      video_error:  renderError ?? 'unknown_error',
      video_url:    null,
    }
  }

  // Only the job the report is currently waiting on may change it — a late
  // callback from a cancelled or superseded job is acknowledged and ignored.
  let applied = false
  if (update) {
    const { data, error } = await supabase
      .from('reports')
      .update(update)
      .eq('id', reportId)
      .eq('video_job_id', jobId)
      .select('id')
    if (error) {
      console.error('Video callback update failed:', error.message)
      return res.status(500).json({ error: 'update_failed' })
    }
    applied = (data?.length ?? 0) > 0
  }

  res.json({ received: true, applied })

  // ── WhatsApp video notification — isolated, fire-and-forget ─────────────
  // Fires AFTER the response is sent. Never throws, never blocks, never
  // affects the callback response above under any circumstances.
  if (status === 'completed' && applied) {
    notifyWhatsAppVideoReady(reportId).catch((err) => {
      console.error('[WhatsApp] video notification failed (non-fatal):', err.message)
    })
  }
}
