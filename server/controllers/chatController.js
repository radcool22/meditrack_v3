import supabase from '../services/supabase.js'
import openai from '../services/openai.js'
import { buildChatSystemPrompt, buildCombinedChatSystemPrompt, buildReportPageChatSystemPrompt } from '../services/prompts/chat.js'
import { getLanguage, isSupported } from '../config/languages.js'

const MAX_MESSAGE_CHARS = 2000
const MAX_HISTORY_TURNS = 20

const CHAT_FAILED = 'Sorry, I could not answer just now. Please try again in a moment.'

// History arrives from the client, so it is untrusted: only user/assistant
// turns with plain-string content get into the prompt (a "system" turn here
// would let anyone rewrite the assistant's instructions).
function sanitizeHistory(history) {
  if (!Array.isArray(history)) return []
  return history
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_HISTORY_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }))
}

function validMessage(message) {
  return typeof message === 'string' && message.trim() !== '' && message.length <= MAX_MESSAGE_CHARS
}

// Appended to the system prompt when the user has chosen a reply language
// (website dropdown or WhatsApp). Unsupported/missing codes add nothing, which
// leaves the prompt's auto-detect rule in charge.
function languageOverride(language) {
  if (!isSupported(language)) return ''
  const lang = getLanguage(language)
  if (lang.code === 'hi') return '\n\nOVERRIDE — USER LANGUAGE PREFERENCE: The user has explicitly chosen Hindi. ' + lang.promptInstruction
  if (lang.code === 'en') return '\n\nOVERRIDE — USER LANGUAGE PREFERENCE: The user has explicitly chosen English. ' + lang.promptInstruction
  return '\n\n' + lang.promptInstruction
}

async function complete(systemPrompt, history, message, maxTokens) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message.trim() },
    ],
    temperature: 0.4,
    max_tokens: maxTokens,
  })
  return completion.choices[0].message.content
}

async function latestAnalysis(reportId) {
  const { data } = await supabase
    .from('report_analyses')
    .select('summary, abnormal_values, suggestions')
    .eq('report_id', reportId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

async function saveTurns(reportId, userId, message, reply) {
  const { error } = await supabase.from('chat_messages').insert([
    { report_id: reportId, user_id: userId, role: 'user', content: message.trim(), message_type: 'text' },
    { report_id: reportId, user_id: userId, role: 'assistant', content: reply, message_type: 'text' },
  ])
  if (error) console.error('Chat save error:', error.message)
}

export async function sendMessage(req, res) {
  const { reportId } = req.params
  const { userId } = req.user
  const { message } = req.body
  const history = sanitizeHistory(req.body.history)

  if (!validMessage(message)) {
    return res.status(400).json({ error: 'Message is required' })
  }

  try {
    // Load report + user name in parallel
    const [{ data: report }, { data: userRow }] = await Promise.all([
      supabase.from('reports').select('id, structured_data, status, report_date, uploaded_at').eq('id', reportId).eq('user_id', userId).maybeSingle(),
      supabase.from('users').select('name').eq('id', userId).maybeSingle(),
    ])

    if (!report) return res.status(404).json({ error: 'Report not found' })
    if (report.status !== 'done') {
      return res.status(400).json({ error: 'Report analysis is not ready yet' })
    }

    const analysis       = await latestAnalysis(reportId)
    const userName       = userRow?.name?.split(' ')[0] ?? null
    const isFirstMessage = history.length === 0
    const systemPrompt   = buildChatSystemPrompt(report, analysis, userName, isFirstMessage)

    const reply = await complete(systemPrompt, history, message, 400)
    await saveTurns(reportId, userId, message, reply)
    return res.json({ reply })
  } catch (err) {
    console.error('Chat error:', err.message)
    return res.status(502).json({ error: CHAT_FAILED })
  }
}

// Throws on failure — callers (website handler, WhatsApp) decide what the user sees.
export async function generateCombinedChatReply(userId, userMessage, history = [], language = null) {
  // Load all done reports + user name in parallel
  // Order by report_date (the date on the document) ascending — nulls last via uploaded_at
  const [{ data: reports }, { data: userRow }] = await Promise.all([
    supabase.from('reports').select('id, file_name, uploaded_at, report_date, structured_data').eq('user_id', userId).eq('status', 'done').order('report_date', { ascending: true, nullsFirst: false }),
    supabase.from('users').select('name').eq('id', userId).maybeSingle(),
  ])

  // Attach latest analysis to each report
  const reportsWithAnalysis = await Promise.all(
    (reports ?? []).map(async (r) => ({ ...r, analysis: await latestAnalysis(r.id) }))
  )

  const cleanHistory   = sanitizeHistory(history)
  const userName       = userRow?.name?.split(' ')[0] ?? null
  const isFirstMessage = cleanHistory.length === 0
  const systemPrompt   = buildCombinedChatSystemPrompt(reportsWithAnalysis, userName, isFirstMessage)

  return complete(systemPrompt + languageOverride(language), cleanHistory, userMessage, 500)
}

export async function sendCombinedMessage(req, res) {
  const { userId } = req.user
  const { message, history, language } = req.body

  if (!validMessage(message)) return res.status(400).json({ error: 'Message is required' })

  try {
    const reply = await generateCombinedChatReply(userId, message, history, language)
    return res.json({ reply })
  } catch (err) {
    console.error('Combined chat error:', err.message)
    return res.status(502).json({ error: CHAT_FAILED })
  }
}

export async function getHistory(req, res) {
  const { reportId } = req.params
  const { userId } = req.user

  // Verify ownership
  const { data: report } = await supabase
    .from('reports')
    .select('id')
    .eq('id', reportId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!report) return res.status(404).json({ error: 'Report not found' })

  const { data: messages, error } = await supabase
    .from('chat_messages')
    .select('id, role, content, message_type, created_at')
    .eq('report_id', reportId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Chat history error:', error.message)
    return res.status(500).json({ error: 'Failed to load history' })
  }

  return res.json({ messages: messages ?? [] })
}

// ── Report-page restricted chat ────────────────────────────────────────

export async function sendReportChatMessage(req, res) {
  const { reportId } = req.params
  const { userId } = req.user
  const { message, language } = req.body
  const history = sanitizeHistory(req.body.history)

  if (!validMessage(message)) {
    return res.status(400).json({ error: 'Message is required' })
  }

  try {
    const [{ data: report }, { data: userRow }] = await Promise.all([
      supabase.from('reports').select('id, structured_data, status, report_date, uploaded_at').eq('id', reportId).eq('user_id', userId).maybeSingle(),
      supabase.from('users').select('name').eq('id', userId).maybeSingle(),
    ])

    if (!report) return res.status(404).json({ error: 'Report not found' })
    if (report.status !== 'done') {
      return res.status(400).json({ error: 'Report analysis is not ready yet' })
    }

    const analysis       = await latestAnalysis(reportId)
    const userName       = userRow?.name?.split(' ')[0] ?? null
    const isFirstMessage = history.length === 0
    const systemPrompt   = buildReportPageChatSystemPrompt(report, analysis, userName, isFirstMessage)

    const reply = await complete(systemPrompt + languageOverride(language), history, message, 400)
    await saveTurns(reportId, userId, message, reply)
    return res.json({ reply })
  } catch (err) {
    console.error('Report chat error:', err.message)
    return res.status(502).json({ error: CHAT_FAILED })
  }
}

export async function getReportChatHistory(req, res) {
  return getHistory(req, res)
}
