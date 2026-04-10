import supabase from '../services/supabase.js'
import openai from '../services/openai.js'
import { buildChatSystemPrompt, buildCombinedChatSystemPrompt } from '../services/prompts/chat.js'

export async function sendMessage(req, res) {
  const { reportId } = req.params
  const { userId } = req.user
  const { message, history = [] } = req.body

  if (!message?.trim()) {
    return res.status(400).json({ error: 'Message is required' })
  }

  // Load report + user name in parallel
  const [{ data: report }, { data: userRow }] = await Promise.all([
    supabase.from('reports').select('id, structured_data, status').eq('id', reportId).eq('user_id', userId).maybeSingle(),
    supabase.from('users').select('name').eq('id', userId).maybeSingle(),
  ])

  if (!report) return res.status(404).json({ error: 'Report not found' })
  if (report.status !== 'done') {
    return res.status(400).json({ error: 'Report analysis is not ready yet' })
  }

  // Load latest analysis
  const { data: analysis } = await supabase
    .from('report_analyses')
    .select('summary, abnormal_values, suggestions')
    .eq('report_id', reportId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const userName       = userRow?.name?.split(' ')[0] ?? null
  const isFirstMessage = history.length === 0
  const systemPrompt   = buildChatSystemPrompt(report, analysis, userName, isFirstMessage)

  // Build messages array: system + history + new user message
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message.trim() },
  ]

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    temperature: 0.4,
    max_tokens: 400,
  })

  const reply = completion.choices[0].message.content

  // Save both turns to chat_messages
  await supabase.from('chat_messages').insert([
    { report_id: reportId, user_id: userId, role: 'user', content: message.trim(), message_type: 'text' },
    { report_id: reportId, user_id: userId, role: 'assistant', content: reply, message_type: 'text' },
  ])

  return res.json({ reply })
}

export async function sendCombinedMessage(req, res) {
  const { userId } = req.user
  const { message, history = [] } = req.body

  if (!message?.trim()) return res.status(400).json({ error: 'Message is required' })

  // Load all done reports + user name in parallel
  // Order by report_date (the date on the document) ascending — nulls last via uploaded_at
  const [{ data: reports }, { data: userRow }] = await Promise.all([
    supabase.from('reports').select('id, file_name, uploaded_at, report_date, structured_data').eq('user_id', userId).eq('status', 'done').order('report_date', { ascending: true, nullsFirst: false }),
    supabase.from('users').select('name').eq('id', userId).maybeSingle(),
  ])

  // Attach latest analysis to each report
  const reportsWithAnalysis = await Promise.all(
    (reports ?? []).map(async (r) => {
      const { data: analysis } = await supabase
        .from('report_analyses')
        .select('summary, abnormal_values, suggestions')
        .eq('report_id', r.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return { ...r, analysis }
    })
  )

  const userName       = userRow?.name?.split(' ')[0] ?? null
  const isFirstMessage = history.length === 0
  const systemPrompt   = buildCombinedChatSystemPrompt(reportsWithAnalysis, userName, isFirstMessage)

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message.trim() },
  ]

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    temperature: 0.4,
    max_tokens: 500,
  })

  return res.json({ reply: completion.choices[0].message.content })
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
