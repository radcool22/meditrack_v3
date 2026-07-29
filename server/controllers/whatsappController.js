import { findUserByWhatsAppNumber, sendWhatsAppText, sendWhatsAppAudio, sendWhatsAppVideo, downloadWhatsAppMedia, processReportFromBuffer, upsertWhatsAppSession, triggerVideoFromWhatsApp, getOrCreateSession, updateSessionState, detectLanguageSwitch, appendHistory, getDoneReports, triggerVideoForReport, transcribeWhatsAppAudio } from '../services/whatsappService.js'
import { generateCombinedChatReply } from './chatController.js'
import { generateTtsBuffer } from '../services/elevenLabsTts.js'

// Mirrors the detection patterns in whatsappService.js, used to strip the
// switch phrase from a message so we can find any remaining request content.
// Longer alternatives are listed first so they consume the full phrase before
// the bare 'english'/'hindi' fallback can match.
const LANG_PHRASE_RE = /\b(?:speak\s+in\s+(?:english|hindi)|talk\s+in\s+(?:english|hindi)|reply\s+in\s+(?:english|hindi)|switch\s+to\s+(?:english|hindi)|hindi\s+mein\s+baat\s+karo|(?:english|hindi)\s+me(?:in?|h)?|in\s+(?:english|hindi)|(?:english|hindi)\s+please|english|hindi)\b|हिंदी|हिन्दी/gi

const VIDEO_STRINGS = {
  en: {
    noReports:     'Please upload a medical report first before requesting a video.',
    listHeader:    'You have multiple reports. Which one would you like a video for?',
    listFooter:    'Reply with the number of the report.',
    confirm:       (title) => `Generating a video for *${title}*. I'll message you here when it's ready.`,
    invalidChoice: (max)   => `Please reply with a number between 1 and ${max}.`,
    alreadyGen:    "A video is already being generated for this report. I'll notify you when it's ready.",
    notReady:      'Your report is still being analysed. Please wait a moment and try again.',
    genFailed:     "Sorry, I couldn't start video generation right now. Please try again.",
  },
  hi: {
    noReports:     'पहले कोई मेडिकल रिपोर्ट अपलोड करें, फिर वीडियो के लिए कहें।',
    listHeader:    'आपके पास कई रिपोर्ट हैं। किसके लिए वीडियो बनाना है?',
    listFooter:    'जिस रिपोर्ट के लिए वीडियो चाहिए, उसका नंबर भेजें।',
    confirm:       (title) => `*${title}* के लिए वीडियो बन रहा है — तैयार होने पर आपको बताऊंगा।`,
    invalidChoice: (max)   => `कृपया 1 से ${max} के बीच कोई नंबर भेजें।`,
    alreadyGen:    'इस रिपोर्ट का वीडियो पहले से बन रहा है। तैयार होने पर आपको बताऊंगा।',
    notReady:      'यह रिपोर्ट अभी विश्लेषण में है। थोड़ी देर बाद फिर से कहें।',
    genFailed:     'अभी वीडियो शुरू नहीं हो पाया। कृपया फिर से कहें।',
  },
}

function formatReportDate(dateStr) {
  if (!dateStr) return null
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return null }
}

function buildReportListMessage(reportList, lang) {
  const s     = VIDEO_STRINGS[lang] ?? VIDEO_STRINGS.en
  const lines = reportList.map((r, i) => {
    const date  = formatReportDate(r.date)
    const label = date ? `${r.title} — ${date}` : r.title
    return `${i + 1}. ${label}`
  })
  return `${s.listHeader}\n\n${lines.join('\n')}\n\n${s.listFooter}`
}

// Delivers a chat reply in the appropriate modality.
// Status/system messages always use sendWhatsAppText regardless of isVoice.
async function sendChatReply(waId, text, lang, isVoice) {
  if (isVoice) {
    try {
      const audioBuffer = await generateTtsBuffer(text, lang)
      await sendWhatsAppAudio(waId, audioBuffer)
    } catch (err) {
      console.error('[WhatsApp] voice reply TTS/send error:', err.message)
    }
  } else {
    await sendWhatsAppText(waId, text)
  }
}

// Shared routing core — called by both text and voice handlers after any
// modality-specific pre-processing (transcription for voice). isVoice=true
// causes only the final chat reply to be delivered as audio; all system
// messages (confirmations, errors, disambiguation lists) are always text.
async function handleMessage(waId, user, text, isVoice) {
  const session = await getOrCreateSession(waId, user.id)
  console.log('[WhatsApp] session language:', session.language ?? 'en', '| pending_action:', session.pending_action ?? 'none', '| history turns:', Array.isArray(session.recent_history) ? session.recent_history.length : 0)

  // 1. Pending-action resolution — runs first so a numbered reply to a
  //    disambiguation list is never misrouted, regardless of input modality.
  if (session.pending_action === 'awaiting_video_report_choice') {
    const reports   = session.pending_data?.reports ?? []
    const lang      = session.language ?? 'en'
    const s         = VIDEO_STRINGS[lang] ?? VIDEO_STRINGS.en
    const choiceNum = parseInt(text.trim(), 10)

    if (!choiceNum || choiceNum < 1 || choiceNum > reports.length) {
      await sendWhatsAppText(waId, s.invalidChoice(reports.length))
      return
    }

    const chosen = reports[choiceNum - 1]
    await updateSessionState(waId, { pending_action: null, pending_data: null })

    try {
      await triggerVideoForReport(user.id, chosen.id, waId)
      await sendWhatsAppText(waId, s.confirm(chosen.title))
    } catch (err) {
      console.error('[WhatsApp] triggerVideoForReport error:', err.message)
      const errMsg = err.code === 'already_generating' ? s.alreadyGen
                   : err.code === 'not_ready'           ? s.notReady
                   : s.genFailed
      await sendWhatsAppText(waId, errMsg)
    }
    return
  }

  // 2. Language-switch detection
  const switchedLang = detectLanguageSwitch(text)
  if (switchedLang) {
    await updateSessionState(waId, { language: switchedLang })

    const stripped       = text.replace(LANG_PHRASE_RE, '').replace(/[,\s]+/g, ' ').trim()
    const remainingWords = stripped.split(/\s+/).filter(w => w.length > 1)

    if (remainingWords.length > 2) {
      // Real content alongside the language switch — process in the new language
      if (/\bvideo\b/i.test(stripped)) {
        const sv          = VIDEO_STRINGS[switchedLang] ?? VIDEO_STRINGS.en
        const doneReports = await getDoneReports(user.id)
        if (doneReports.length === 0) { await sendWhatsAppText(waId, sv.noReports); return }
        if (doneReports.length === 1) {
          try {
            await triggerVideoForReport(user.id, doneReports[0].id, waId)
            await sendWhatsAppText(waId, sv.confirm(doneReports[0].report_title ?? 'your report'))
          } catch (err) {
            console.error('[WhatsApp] triggerVideoForReport error:', err.message)
            const errMsg = err.code === 'already_generating' ? sv.alreadyGen
                         : err.code === 'not_ready'           ? sv.notReady
                         : sv.genFailed
            await sendWhatsAppText(waId, errMsg)
          }
          return
        }
        const reportList = doneReports.map(r => ({ id: r.id, title: r.report_title ?? 'Untitled', date: r.report_date }))
        await updateSessionState(waId, { pending_action: 'awaiting_video_report_choice', pending_data: { reports: reportList } })
        await sendWhatsAppText(waId, buildReportListMessage(reportList, switchedLang))
        return
      }
      // Non-video content — route to chat in new language
      const history = Array.isArray(session.recent_history) ? session.recent_history : []
      const reply   = await generateCombinedChatReply(user.id, stripped, history, switchedLang)
      await sendChatReply(waId, reply, switchedLang, isVoice)
      const h1 = appendHistory({ recent_history: history }, 'user', text)
      const h2 = appendHistory({ recent_history: h1 },      'assistant', reply)
      await updateSessionState(waId, { recent_history: h2 })
      return
    }

    // Pure language switch — confirm in the new language
    const confirmation = switchedLang === 'hi'
      ? 'ठीक है — अब मैं हिंदी में जवाब दूंगा।'
      : "Done — I'll reply in English from now on."
    await sendWhatsAppText(waId, confirmation)
    return
  }

  // 3. Video intent — smart disambiguation if user has multiple done reports
  if (/\bvideo\b/i.test(text)) {
    const lang        = session.language ?? 'en'
    const s           = VIDEO_STRINGS[lang] ?? VIDEO_STRINGS.en
    const doneReports = await getDoneReports(user.id)

    if (doneReports.length === 0) { await sendWhatsAppText(waId, s.noReports); return }

    if (doneReports.length === 1) {
      try {
        await triggerVideoForReport(user.id, doneReports[0].id, waId)
        await sendWhatsAppText(waId, s.confirm(doneReports[0].report_title ?? 'your report'))
      } catch (err) {
        console.error('[WhatsApp] triggerVideoForReport error:', err.message)
        const errMsg = err.code === 'already_generating' ? s.alreadyGen
                     : err.code === 'not_ready'           ? s.notReady
                     : s.genFailed
        await sendWhatsAppText(waId, errMsg)
      }
      return
    }

    const reportList = doneReports.map(r => ({ id: r.id, title: r.report_title ?? 'Untitled', date: r.report_date }))
    await updateSessionState(waId, { pending_action: 'awaiting_video_report_choice', pending_data: { reports: reportList } })
    await sendWhatsAppText(waId, buildReportListMessage(reportList, lang))
    return
  }

  // 4. Chat — stored language + rolling history
  const history = Array.isArray(session.recent_history) ? session.recent_history : []
  const lang    = session.language ?? 'en'
  const reply   = await generateCombinedChatReply(user.id, text, history, lang)
  await sendChatReply(waId, reply, lang, isVoice)

  const h1 = appendHistory({ recent_history: history }, 'user', text)
  const h2 = appendHistory({ recent_history: h1 },      'assistant', reply)
  await updateSessionState(waId, { recent_history: h2 })
}

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
    await handleMessage(waId, user, messageText, false)
    return
  }

  if (msg.type === 'audio' || msg.type === 'voice') {
    const mediaId = msg.audio?.id ?? msg.voice?.id
    if (!mediaId) return

    let transcribed
    try {
      transcribed = await transcribeWhatsAppAudio(mediaId)
      console.log('[WhatsApp] transcribed from', waId, ':', transcribed)
    } catch (err) {
      console.error('[WhatsApp] transcription error:', err.message)
      await sendWhatsAppText(waId, "Sorry, I couldn't understand your voice note. Please type your question instead.")
      return
    }

    if (!transcribed?.trim()) {
      await sendWhatsAppText(waId, "I couldn't make out anything in your voice note. Please type your question.")
      return
    }

    await handleMessage(waId, user, transcribed, true)
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
