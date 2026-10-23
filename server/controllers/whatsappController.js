import { findUserByWhatsAppNumber, sendWhatsAppText, sendWhatsAppAudio, downloadWhatsAppMedia, processReportFromBuffer, upsertWhatsAppSession, getOrCreateSession, updateSessionState, setUserLanguagePreference, detectLanguageSwitch, appendHistory, getDoneReports, triggerVideoForReport, transcribeWhatsAppAudio, isValidWhatsAppSignature, translateForUser } from '../services/whatsappService.js'
import { generateCombinedChatReply } from './chatController.js'
import { generateTtsBuffer } from '../services/elevenLabsTts.js'

// Mirrors the detection patterns in whatsappService.js, used to strip the
// switch phrase from a message so we can find any remaining request content.
// Longer alternatives are listed first so they consume the full phrase before
// the bare language-name fallback can match.
const LANG_PHRASE_RE = /\b(?:speak\s+in\s+(?:english|hindi|marathi|gujarati|malayalam)|talk\s+in\s+(?:english|hindi|marathi|gujarati|malayalam)|reply\s+in\s+(?:english|hindi|marathi|gujarati|malayalam)|switch\s+to\s+(?:english|hindi|marathi|gujarati|malayalam)|(?:hindi|marathi|gujarati|malayalam)\s+mein\s+baat\s+karo|(?:english|hindi|marathi|gujarati|malayalam)\s+me(?:in?|h)?|in\s+(?:english|hindi|marathi|gujarati|malayalam)|(?:english|hindi|marathi|gujarati|malayalam)\s+please|english|hindi|marathi|gujarati|malayalam)\b|हिंदी|हिन्दी|मराठी|ગુજરાતી|മലയാളം/gi

// "video" in Latin or Devanagari script
const VIDEO_INTENT_RE = /\bvideo\b|वीडियो|विडियो/i

// Native-script confirmation sent after a pure language switch (no other
// content in the message). Marathi/Gujarati/Malayalam text is best-effort
// machine-authored — have a native speaker sanity-check before relying on it.
const SWITCH_CONFIRMATIONS = {
  en: "Done — I'll reply in English from now on.",
  hi: 'ठीक है — अब मैं हिंदी में जवाब दूंगा।',
  mr: 'ठीक आहे — आता मी मराठीत उत्तर देईन.',
  gu: 'સારું — હવે હું ગુજરાતીમાં જવાબ આપીશ.',
  ml: 'ശരി — ഇനി ഞാൻ മലയാളത്തിൽ മറുപടി നൽകും.',
}

const VIDEO_STRINGS = {
  en: {
    noReports:     'Please upload a medical report first before requesting a video.',
    listHeader:    'You have multiple reports. Which one would you like a video for?',
    listFooter:    'Reply with the number of the report.',
    askAge:        (title) => `To make the video for *${title}*, please reply with the patient's age in years (for example: 45).`,
    invalidAge:    'Please reply with the age as a number, for example: 45.',
    specialist:    'This report is for someone under 18. Please discuss it with a specialist doctor — we do not make videos for children\'s reports.',
    noNumbers:     'This report has no number values to explain in a video. You can still ask me questions about it here.',
    busy:          'Our video service is busy right now. Please ask again in a minute.',
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
    askAge:        (title) => `*${title}* का वीडियो बनाने के लिए, कृपया मरीज़ की उम्र (सालों में) भेजें — जैसे: 45`,
    invalidAge:    'कृपया उम्र सिर्फ़ नंबर में भेजें — जैसे: 45',
    specialist:    'यह रिपोर्ट 18 साल से कम उम्र की है। कृपया इसे किसी specialist doctor के साथ discuss करें — बच्चों की रिपोर्ट के वीडियो हम नहीं बनाते।',
    noNumbers:     'इस रिपोर्ट में वीडियो में समझाने के लिए कोई नंबर वाली values नहीं हैं। आप यहाँ इसके बारे में सवाल पूछ सकते हैं।',
    busy:          'वीडियो सेवा अभी व्यस्त है। कृपया एक मिनट बाद फिर से कहें।',
    confirm:       (title) => `*${title}* के लिए वीडियो बन रहा है — तैयार होने पर आपको बताऊंगा।`,
    invalidChoice: (max)   => `कृपया 1 से ${max} के बीच कोई नंबर भेजें।`,
    alreadyGen:    'इस रिपोर्ट का वीडियो पहले से बन रहा है। तैयार होने पर आपको बताऊंगा।',
    notReady:      'यह रिपोर्ट अभी विश्लेषण में है। थोड़ी देर बाद फिर से कहें।',
    genFailed:     'अभी वीडियो शुरू नहीं हो पाया। कृपया फिर से कहें।',
  },
}

const CHAT_FAILED_TEXT = "Sorry, I couldn't answer just now. Please try again in a moment."

function videoStrings(lang) {
  return VIDEO_STRINGS[lang] ?? VIDEO_STRINGS.en
}

function formatReportDate(dateStr) {
  if (!dateStr) return null
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return null }
}

function buildReportListMessage(reportList, lang) {
  const s     = videoStrings(lang)
  const lines = reportList.map((r, i) => {
    const date  = formatReportDate(r.date)
    const label = date ? `${r.title} — ${date}` : r.title
    return `${i + 1}. ${label}`
  })
  return `${s.listHeader}\n\n${lines.join('\n')}\n\n${s.listFooter}`
}

// Recent message ids — Meta retries webhooks, and a retried report upload or
// video request must not be processed twice.
const seenMessageIds = new Set()
const MAX_SEEN_IDS = 1000

function alreadySeen(messageId) {
  if (!messageId) return false
  if (seenMessageIds.has(messageId)) return true
  seenMessageIds.add(messageId)
  if (seenMessageIds.size > MAX_SEEN_IDS) seenMessageIds.delete(seenMessageIds.values().next().value)
  return false
}

// Delivers a chat reply in the appropriate modality.
// Status/system messages always use sendWhatsAppText regardless of isVoice.
// Voice degrades gracefully to text on any TTS/audio-send failure (e.g. an
// eleven_v3 call for mr/gu/ml failing) instead of silently dropping the reply.
async function sendChatReply(waId, text, lang, isVoice) {
  if (isVoice) {
    try {
      const audioBuffer = await generateTtsBuffer(text, lang)
      await sendWhatsAppAudio(waId, audioBuffer)
      return
    } catch (err) {
      console.error(`[WhatsApp] voice reply failed (lang=${lang}) — falling back to text:`, err.message)
    }
  }
  await sendWhatsAppText(waId, text)
}

// Chat turn: reply via the combined-reports assistant and keep rolling history.
async function replyWithChat(waId, user, session, text, lang, isVoice) {
  const history = Array.isArray(session.recent_history) ? session.recent_history : []
  let reply
  try {
    reply = await generateCombinedChatReply(user.id, text, history, lang)
  } catch (err) {
    console.error('[WhatsApp] chat reply failed:', err.message)
    await sendWhatsAppText(waId, CHAT_FAILED_TEXT)
    return
  }
  await sendChatReply(waId, reply, lang, isVoice)
  const h1 = appendHistory({ recent_history: history }, 'user', text)
  const h2 = appendHistory({ recent_history: h1 },      'assistant', reply)
  await updateSessionState(waId, { recent_history: h2 })
}

function videoErrorMessage(s, err) {
  switch (err.code) {
    case 'already_generating':  return s.alreadyGen
    case 'not_ready':           return s.notReady
    case 'specialist_required': return s.specialist
    case 'no_numeric_values':   return s.noNumbers
    case 'rate_limited':        return s.busy
    default:                    return s.genFailed
  }
}

// Video step 2: ask the patient's age (the render's pediatric safety gate needs it).
async function askAgeFor(waId, report, lang) {
  await updateSessionState(waId, { pending_action: 'awaiting_video_age', pending_data: { report } })
  await sendWhatsAppText(waId, videoStrings(lang).askAge(report.title))
}

// Video step 1: pick the report (skipped when there's only one).
async function startVideoFlow(waId, user, lang) {
  const s           = videoStrings(lang)
  const doneReports = await getDoneReports(user.id)

  if (doneReports.length === 0) { await sendWhatsAppText(waId, s.noReports); return }

  const reportList = doneReports.map(r => ({ id: r.id, title: r.report_title ?? 'Untitled', date: r.report_date }))
  if (reportList.length === 1) { await askAgeFor(waId, reportList[0], lang); return }

  await updateSessionState(waId, { pending_action: 'awaiting_video_report_choice', pending_data: { reports: reportList } })
  await sendWhatsAppText(waId, buildReportListMessage(reportList, lang))
}

// Resolves a pending video step. Returns false when the message isn't an
// answer to it (not a number) — the pending step is dropped and the message
// is handled normally, so the user can never get stuck in the flow.
async function resolvePendingVideoStep(waId, user, session, text) {
  const lang   = session.language ?? 'en'
  const s      = videoStrings(lang)
  // "2", "45", "45 years", "45 साल"
  const answer = text.trim().match(/^(\d{1,3})\s*(?:years?|yrs?|saal|साल|वर्ष)?\s*[.!]*$/i)

  if (!answer) {
    await updateSessionState(waId, { pending_action: null, pending_data: null })
    return false
  }
  const n = parseInt(answer[1], 10)

  if (session.pending_action === 'awaiting_video_report_choice') {
    const reports = session.pending_data?.reports ?? []
    if (n < 1 || n > reports.length) {
      await sendWhatsAppText(waId, s.invalidChoice(reports.length))
      return true
    }
    await askAgeFor(waId, reports[n - 1], lang)
    return true
  }

  // awaiting_video_age
  const report = session.pending_data?.report
  if (!report?.id || n < 1 || n > 120) {
    await sendWhatsAppText(waId, s.invalidAge)
    return true
  }
  await updateSessionState(waId, { pending_action: null, pending_data: null })
  try {
    await triggerVideoForReport(user.id, report.id, waId, n)
    await sendWhatsAppText(waId, s.confirm(report.title))
  } catch (err) {
    console.error('[WhatsApp] triggerVideoForReport error:', err.code ?? err.message)
    await sendWhatsAppText(waId, videoErrorMessage(s, err))
  }
  return true
}

// Shared routing core — called by both text and voice handlers after any
// modality-specific pre-processing (transcription for voice). isVoice=true
// causes only the final chat reply to be delivered as audio; all system
// messages (confirmations, errors, disambiguation lists) are always text.
async function handleMessage(waId, user, text, isVoice) {
  const session = await getOrCreateSession(waId, user.id)

  // 1. Pending video step — runs first so a numbered reply is never misrouted.
  if (session.pending_action === 'awaiting_video_report_choice' || session.pending_action === 'awaiting_video_age') {
    if (await resolvePendingVideoStep(waId, user, session, text)) return
  }

  // 2. Language-switch detection
  const switchedLang = detectLanguageSwitch(text)
  if (switchedLang) {
    await updateSessionState(waId, { language: switchedLang })
    await setUserLanguagePreference(user.id, switchedLang)

    const stripped       = text.replace(LANG_PHRASE_RE, '').replace(/[,\s]+/g, ' ').trim()
    const remainingWords = stripped.split(/\s+/).filter(w => w.length > 1)

    if (remainingWords.length > 2) {
      // Real content alongside the language switch — process in the new language
      if (VIDEO_INTENT_RE.test(stripped)) { await startVideoFlow(waId, user, switchedLang); return }
      await replyWithChat(waId, user, session, stripped, switchedLang, isVoice)
      return
    }

    // Pure language switch — confirm in the new language
    await sendWhatsAppText(waId, SWITCH_CONFIRMATIONS[switchedLang] ?? SWITCH_CONFIRMATIONS.en)
    return
  }

  // 3. Video intent — smart disambiguation if user has multiple done reports
  const lang = session.language ?? 'en'
  if (VIDEO_INTENT_RE.test(text)) { await startVideoFlow(waId, user, lang); return }

  // 4. Chat — stored language + rolling history
  await replyWithChat(waId, user, session, text, lang, isVoice)
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
  if (!isValidWhatsAppSignature(req.rawBody, req.headers['x-hub-signature-256'])) {
    console.warn('[WhatsApp] rejected webhook with invalid signature')
    return res.sendStatus(401)
  }

  // Respond immediately — Meta requires a 200 within 5 seconds
  res.sendStatus(200)

  handleIncoming(req.body).catch((err) => {
    console.error('[WhatsApp] handleIncoming unhandled error:', err.message)
  })
}

async function handleIncoming(body) {
  // Webhooks also fire for status updates (delivery/read receipts) — those have no messages array
  const messages = body?.entry?.[0]?.changes?.[0]?.value?.messages
  if (!messages || messages.length === 0) return

  const msg  = messages[0]
  if (alreadySeen(msg.id)) return
  const waId = body.entry[0].changes[0].value.contacts?.[0]?.wa_id ?? msg.from

  const user = await findUserByWhatsAppNumber(waId)

  if (!user) {
    await sendWhatsAppText(waId, 'Hi! You need a MediTrack account to use this service. Please sign up at meditrack.in first.')
    return
  }

  if (msg.type === 'text') {
    await handleMessage(waId, user, msg.text?.body ?? '', false)
    return
  }

  if (msg.type === 'audio' || msg.type === 'voice') {
    const mediaId = msg.audio?.id ?? msg.voice?.id
    if (!mediaId) return

    let transcribed
    try {
      transcribed = await transcribeWhatsAppAudio(mediaId, user.language_preference)
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

    await sendWhatsAppText(waId, 'Got your report — analysing it now, this takes a moment.')

    try {
      const { buffer, mimeType } = await downloadWhatsAppMedia(mediaId)
      const { report, analysis } = await processReportFromBuffer(user.id, buffer, mimeType, fileName)

      await upsertWhatsAppSession(waId, { user_id: user.id, current_report_id: report.id, state: 'idle' })

      const session = await getOrCreateSession(waId, user.id)
      const summary = analysis?.summary ?? 'Your report has been analysed. You can now ask me questions about it.'
      await sendWhatsAppText(waId, await translateForUser(summary, session.language ?? 'en'))
    } catch (err) {
      console.error('[WhatsApp] report processing error:', err.message)
      const message = err.code === 'unsupported_type'
        ? 'Please send your report as a PDF, JPG or PNG file.'
        : 'Sorry, I had trouble reading that report. Please try sending it again, or make sure it is a clear image or PDF.'
      await sendWhatsAppText(waId, message)
    }
    return
  }

  console.log('[WhatsApp] ignoring unsupported message type:', msg.type)
}
