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

async function runGptAnalysis(prompt) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  })
  return JSON.parse(completion.choices[0].message.content)
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

  if (report.status === 'done') {
    // Return cached analysis if it exists
    const { data: existing } = await supabase
      .from('report_analyses')
      .select('*')
      .eq('report_id', reportId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existing) {
      const { data: rpt } = await supabase
        .from('reports')
        .select('report_title, report_date')
        .eq('id', reportId)
        .single()
      return res.json({ analysis: existing, report_title: rpt?.report_title ?? null, report_date: rpt?.report_date ?? null })
    }
    // No analysis row yet — fall through to generate
  }

  // 2. Mark as processing
  await supabase
    .from('reports')
    .update({ status: 'processing' })
    .eq('id', reportId)

  try {
    // 3. Download file and run OCR
    const buffer = await fetchBuffer(report.file_url)
    const rawText = await extractText(buffer, report.file_type)

    // 4. Save raw OCR text
    await supabase
      .from('reports')
      .update({ ocr_raw_text: rawText })
      .eq('id', reportId)

    // 5. GPT call — English: structure + analyse
    const parsed = await runGptAnalysis(buildStructureAndAnalysePrompt(rawText, 'en'))
    const { structured_data: structuredRaw, analysis: enAnalysis } = parsed

    // Extract report_date, report_title and tests array
    const reportDate  = structuredRaw?.report_date ?? null
    const reportTitle = enAnalysis.report_title ?? null
    const testsArray  = Array.isArray(structuredRaw?.tests) ? structuredRaw.tests
                      : Array.isArray(structuredRaw) ? structuredRaw
                      : []
    const structured_data = testsArray

    // 6. Save structured data + report_date + report_title + mark done
    await supabase
      .from('reports')
      .update({ structured_data, report_date: reportDate, report_title: reportTitle, status: 'done' })
      .eq('id', reportId)

    // 7. Insert analysis row (English only)
    const { data: analysisRow, error: analysisErr } = await supabase
      .from('report_analyses')
      .insert({
        report_id:       reportId,
        summary:         enAnalysis.summary,
        abnormal_values: enAnalysis.abnormal_values,
        suggestions:     enAnalysis.suggestions,
        language:        'en',
      })
      .select()
      .single()

    if (analysisErr) {
      console.error('Analysis insert error:', analysisErr.message)
      return res.status(500).json({ error: 'Failed to save analysis' })
    }

    return res.json({ analysis: analysisRow, report_title: reportTitle, report_date: reportDate })
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

  // Verify report ownership and get metadata
  const { data: report } = await supabase
    .from('reports')
    .select('id, status, report_title, report_date')
    .eq('id', reportId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!report) return res.status(404).json({ error: 'Report not found' })

  const { data: analysis } = await supabase
    .from('report_analyses')
    .select('*')
    .eq('report_id', reportId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (analysis) {
    return res.json({
      status: report.status,
      analysis,
      report_title: report.report_title ?? null,
      report_date:  report.report_date  ?? null,
    })
  }

  return res.json({ status: 'pending', analysis: null, report_title: null, report_date: null })
}
