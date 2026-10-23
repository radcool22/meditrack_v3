import supabase from './supabase.js'
import { buildRenderPayload } from './renderPayloadMapper.js'

const RENDER_SERVICE_URL = process.env.RENDER_SERVICE_URL || 'https://meditrack-render-v3.fly.dev'

// Worst case on the render side: two attempts × 8-min render timeout plus
// backoff. A 'generating' row older than this lost its callback — let the
// user start over instead of answering "already generating" forever.
export const STALE_GENERATING_MS = 20 * 60 * 1000

function videoError(code, message, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra })
}

export function isGeneratingStale(report) {
  if (report.video_status !== 'generating') return false
  const requested = report.video_requested_at ? new Date(report.video_requested_at).getTime() : 0
  return Date.now() - requested > STALE_GENERATING_MS
}

// The only place a render is triggered — website and WhatsApp both use it.
// Throws errors with `code`: invalid_age | specialist_required | not_found | not_ready |
// already_generating | no_numeric_values | rate_limited | render_unavailable | render_error
export async function scheduleVideoRender(userId, reportId, ageYears) {
  const age = Number(ageYears)
  if (!Number.isInteger(age) || age < 1 || age > 120) {
    throw videoError('invalid_age', 'A valid age is required')
  }
  // Pediatric reports need a specialist (CLAUDE.md §2.1.6) — the render
  // service enforces this too; stopping here saves the round trip.
  if (age < 18) throw videoError('specialist_required', 'Pediatric report')

  const { data: report, error: reportErr } = await supabase
    .from('reports')
    .select('id, report_title, report_date, structured_data, status, video_status, video_requested_at, user_id')
    .eq('id', reportId)
    .eq('user_id', userId)
    .maybeSingle()

  if (reportErr || !report) throw videoError('not_found', 'Report not found')
  if (report.status !== 'done') throw videoError('not_ready', 'Report not ready')
  if (report.video_status === 'generating' && !isGeneratingStale(report)) {
    throw videoError('already_generating', 'Already generating')
  }

  const { data: user } = await supabase
    .from('users')
    .select('name')
    .eq('id', userId)
    .single()

  const payload = buildRenderPayload({
    report,
    structuredData: report.structured_data ?? [],
    user:           user ?? {},
    ageYears:       age,
  })

  // The video explains numbers; a report of only text results (e.g. "Negative") has none.
  if (payload.findings.length === 0) {
    throw videoError('no_numeric_values', 'Report has no numeric values to explain')
  }

  let renderRes
  try {
    renderRes = await fetch(`${RENDER_SERVICE_URL}/render`, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${process.env.RENDER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err) {
    console.error('Render service unreachable:', err.message)
    throw videoError('render_unavailable', 'Render service unreachable')
  }

  if (renderRes.status === 429) {
    const retryAfterSec = parseInt(renderRes.headers.get('Retry-After') ?? '60', 10)
    throw videoError('rate_limited', 'Render service busy', { retryAfterSec })
  }

  if (!renderRes.ok) {
    const errBody = await renderRes.json().catch(() => ({}))
    console.error('Render service rejected request:', renderRes.status, errBody?.error ?? '')
    throw videoError('render_error', 'Render service error')
  }

  const { jobId } = await renderRes.json().catch(() => ({}))
  if (!jobId) throw videoError('render_error', 'Render service returned no job id')

  const { error: updateErr } = await supabase
    .from('reports')
    .update({
      video_status:       'generating',
      video_job_id:       jobId,
      video_requested_at: new Date().toISOString(),
      video_url:          null,
      video_error:        null,
    })
    .eq('id', reportId)

  if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`)

  return { jobId }
}

// Right-to-delete: asks the render service to remove every video of a report.
// Never throws — a failure here must not block deleting the report itself.
export async function deleteRenderedVideos(reportId) {
  try {
    const res = await fetch(`${RENDER_SERVICE_URL}/videos/${encodeURIComponent(reportId)}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${process.env.RENDER_API_KEY}` },
      signal:  AbortSignal.timeout(15_000),
    })
    if (!res.ok) console.error('Video delete failed:', res.status, '| reportId:', reportId)
  } catch (err) {
    console.error('Video delete failed:', err.message, '| reportId:', reportId)
  }
}
