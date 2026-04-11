import supabase from '../services/supabase.js'
import openai from '../services/openai.js'
import { extractText } from '../services/visionOcr.js'
import { buildStructureAndAnalysePrompt } from '../services/prompts/ocr.js'

async function fetchBuffer(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`)
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function runAnalysis(req, res) {
  const { reportId } = req.params
  const { userId } = req.user

  // 1. Load report — verify ownership
  const { data: report, error: reportErr } = await supabase
    .from('reports')
    .select('id, file_url, file_type, status, user_id')
    .eq('id', reportId)
    .eq('user_id', userId)
    .maybeSingle()

  if (reportErr || !report) {
    return res.status(404).json({ error: 'Report not found' })
  }

  if (report.status === 'processing') {
    return res.status(409).json({ error: 'Analysis already in progress' })
  }

  // 2. Fetch user language preference first (needed for cache check too)
  const { data: user } = await supabase
    .from('users')
    .select('language_preference')
    .eq('id', userId)
    .single()
  const language = user?.language_preference ?? 'en'

  if (report.status === 'done') {
    // Return cached analysis only if it matches the user's current language
    const { data: existing } = await supabase
      .from('report_analyses')
      .select('*')
      .eq('report_id', reportId)
      .eq('language', language)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existing) return res.json({ analysis: existing })
    // Language mismatch — fall through to re-run analysis in the correct language
  }

  // 3. Mark as processing
  await supabase
    .from('reports')
    .update({ status: 'processing' })
    .eq('id', reportId)

  try {
    // 4. Download file and run OCR
    const buffer = await fetchBuffer(report.file_url)
    const rawText = await extractText(buffer, report.file_type)

    // 5. Save raw OCR text
    await supabase
      .from('reports')
      .update({ ocr_raw_text: rawText })
      .eq('id', reportId)

    // 6. Single GPT-4o call — structure + analyse
    const prompt = buildStructureAndAnalysePrompt(rawText, language)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    })

    const parsed = JSON.parse(completion.choices[0].message.content)
    const { structured_data: structuredRaw, analysis } = parsed

    // Extract report_date and tests array from structured_data
    const reportDate   = structuredRaw?.report_date ?? null   // "YYYY-MM-DD" or null
    const testsArray   = Array.isArray(structuredRaw?.tests) ? structuredRaw.tests
                       : Array.isArray(structuredRaw) ? structuredRaw  // backwards compat
                       : []
    // Store tests array as structured_data for downstream consumers
    const structured_data = testsArray

    // 7. Save structured data + report_date + mark done
    await supabase
      .from('reports')
      .update({ structured_data, report_date: reportDate, status: 'done' })
      .eq('id', reportId)

    // 8. Insert analysis row
    const { data: analysisRow, error: analysisErr } = await supabase
      .from('report_analyses')
      .insert({
        report_id: reportId,
        summary: analysis.summary,
        abnormal_values: analysis.abnormal_values,
        suggestions: analysis.suggestions,
        language,
      })
      .select()
      .single()

    if (analysisErr) {
      console.error('Analysis insert error:', analysisErr.message)
      return res.status(500).json({ error: 'Failed to save analysis' })
    }

    return res.json({ analysis: analysisRow })
  } catch (err) {
    console.error('Pipeline error:', err.message)
    await supabase
      .from('reports')
      .update({ status: 'failed' })
      .eq('id', reportId)
    return res.status(500).json({ error: err.message })
  }
}

export async function getAnalysis(req, res) {
  const { reportId } = req.params
  const { userId } = req.user

  // Verify report ownership
  const { data: report } = await supabase
    .from('reports')
    .select('id, status')
    .eq('id', reportId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!report) return res.status(404).json({ error: 'Report not found' })

  // Fetch user language so we serve the right language version
  const { data: user } = await supabase
    .from('users')
    .select('language_preference')
    .eq('id', userId)
    .single()
  const language = user?.language_preference ?? 'en'

  // Look for analysis in the user's current language
  const { data: analysis } = await supabase
    .from('report_analyses')
    .select('*')
    .eq('report_id', reportId)
    .eq('language', language)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (analysis) {
    return res.json({ status: report.status, analysis })
  }

  // No language-matched analysis — signal pending so client re-triggers
  // (the POST /api/analysis/:reportId will re-run in the correct language)
  return res.json({ status: 'pending', analysis: null })
}
