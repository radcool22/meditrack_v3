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
