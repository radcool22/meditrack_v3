import supabase from './supabase.js'
import { buildRenderPayload } from './renderPayloadMapper.js'

const RENDER_SERVICE_URL = process.env.RENDER_SERVICE_URL || 'https://meditrack-render.fly.dev'

// Core render trigger reused by WhatsApp. generateVideo in videoController keeps its own
// inline implementation so its HTTP error responses are never disturbed.
export async function scheduleVideoRender(userId, reportId, ageYears) {
  const { data: report, error: reportErr } = await supabase
    .from('reports')
    .select('id, report_title, report_date, structured_data, status, video_status, user_id')
    .eq('id', reportId)
    .eq('user_id', userId)
    .maybeSingle()

  if (reportErr || !report) throw Object.assign(new Error('Report not found'), { code: 'not_found' })
  if (report.status !== 'done') throw Object.assign(new Error('Report not ready'), { code: 'not_ready' })
  if (report.video_status === 'generating') throw Object.assign(new Error('Already generating'), { code: 'already_generating' })

  const { data: user } = await supabase
    .from('users')
    .select('name')
    .eq('id', userId)
    .single()

  const payload = buildRenderPayload({
    report,
    structuredData: report.structured_data ?? [],
    user:           user ?? {},
    ageYears,
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
    throw new Error(`Render service unreachable: ${err.message}`)
  }

  if (!renderRes.ok) {
    const errBody = await renderRes.json().catch(() => ({}))
    console.error('[scheduleVideoRender] render error:', renderRes.status, errBody)
    throw new Error('Render service error')
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
    .eq('id', reportId)

  if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`)

  return { jobId }
}
