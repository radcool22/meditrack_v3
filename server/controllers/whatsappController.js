import { findUserByWhatsAppNumber, sendWhatsAppText, downloadWhatsAppMedia, processReportFromBuffer, upsertWhatsAppSession, triggerVideoFromWhatsApp } from '../services/whatsappService.js'
import { generateCombinedChatReply } from './chatController.js'

export function verifyWebhook(req, res) {
  const mode      = req.query['hub.mode']
  const token     = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge)
  }

  return res.sendStatus(403)
}

export function receiveMessage(req, res) {
  console.log('[WhatsApp] POST hit')

  // Respond immediately — Meta requires a 200 within 5 seconds
  res.sendStatus(200)

  try {
    console.log('[WhatsApp] raw body:', JSON.stringify(req.body, null, 2))
  } catch (err) {
    console.error('[WhatsApp] failed to stringify body:', err.message, '| typeof body:', typeof req.body)
  }

  handleIncoming(req.body).catch((err) => {
    console.error('[WhatsApp] handleIncoming unhandled error:', err.message)
  })
}

async function handleIncoming(body) {
  // Webhooks also fire for status updates (delivery/read receipts) — those have no messages array
  const messages = body?.entry?.[0]?.changes?.[0]?.value?.messages
  if (!messages || messages.length === 0) return

  const msg  = messages[0]
  const waId = body.entry[0].changes[0].value.contacts?.[0]?.wa_id ?? msg.from

  const user = await findUserByWhatsAppNumber(waId)

  if (!user) {
    console.log('[WhatsApp] no registered user for wa_id:', waId)
    await sendWhatsAppText(waId, 'Hi! You need a MediTrack account to use this service. Please sign up at meditrack.in first.')
    return
  }

  console.log('[WhatsApp] user found — id:', user.id, '| name:', user.name ?? '(no name)')

  if (msg.type === 'text') {
    const messageText = msg.text?.body ?? ''
    console.log('[WhatsApp] text from', waId, ':', messageText)

    if (/\bvideo\b/i.test(messageText)) {
      try {
        await triggerVideoFromWhatsApp(user.id, waId)
        await sendWhatsAppText(waId, "Your video is being generated — I'll message you here when it's ready. This usually takes a minute or two.")
      } catch (err) {
        console.error('[WhatsApp] video trigger error:', err.message)
        const errReply = err.code === 'no_report'         ? 'Please upload a medical report first before requesting a video.'
                       : err.code === 'not_ready'          ? 'Your report is still being analysed. Please wait a moment and try again.'
                       : err.code === 'already_generating' ? "A video is already being generated for this report. I'll notify you when it's ready."
                       : "Sorry, I couldn't start video generation right now. Please try again in a moment."
        await sendWhatsAppText(waId, errReply)
      }
      return
    }

    const reply = await generateCombinedChatReply(user.id, messageText)
    await sendWhatsAppText(waId, reply)
    return
  }

  if (msg.type === 'image' || msg.type === 'document') {
    const mediaId  = msg.type === 'image' ? msg.image.id : msg.document.id
    const fileName = msg.type === 'document'
      ? (msg.document.filename ?? `report_${Date.now()}.pdf`)
      : `report_${Date.now()}.jpg`

    console.log('[WhatsApp] media message | type:', msg.type, '| mediaId:', mediaId, '| fileName:', fileName)
    await sendWhatsAppText(waId, 'Got your report — analysing it now, this takes a moment.')

    try {
      const { buffer, mimeType } = await downloadWhatsAppMedia(mediaId)
      const { report, analysis } = await processReportFromBuffer(user.id, buffer, mimeType, fileName)

      await upsertWhatsAppSession(waId, { user_id: user.id, current_report_id: report.id, state: 'idle' })

      const summary = analysis?.summary ?? 'Your report has been analysed. You can now ask me questions about it.'
      await sendWhatsAppText(waId, summary)
    } catch (err) {
      console.error('[WhatsApp] report processing error:', err.message)
      await sendWhatsAppText(waId, 'Sorry, I had trouble reading that report. Please try sending it again, or make sure it is a clear image or PDF.')
    }
    return
  }

  console.log('[WhatsApp] ignoring unsupported message type:', msg.type, '| from:', waId)
}
