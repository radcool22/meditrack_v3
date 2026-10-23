import supabase from '../services/supabase.js'
import openai from '../services/openai.js'
import { extractText } from '../services/visionOcr.js'
import { buildStructureAndAnalysePrompt } from '../services/prompts/ocr.js'
import { downloadReportFile } from './reportsController.js'

// Reports this server process is analysing right now. A DB row stuck at
// 'processing' that isn't in here was orphaned by a crash/restart and may be
// re-run (single Fly machine, so process memory is the source of truth).
const inFlight = new Set()

async function runGptAnalysis(prompt) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  })
  return JSON.parse(completion.choices[0].message.content)
}

export async function runAnalysisPipeline(reportId, fileType, fileUrl, buffer = null) {
  inFlight.add(reportId)
  try {
    return await analyse(reportId, fileType, fileUrl, buffer)
  } finally {
    inFlight.delete(reportId)
  }
}

async function analyse(reportId, fileType, fileUrl, buffer) {
  const fileBuffer = buffer ?? await downloadReportFile(fileUrl)
  const rawText    = await extractText(fileBuffer, fileType)

  await supabase.from('reports').update({ ocr_raw_text: rawText }).eq('id', reportId)

  const parsed = await runGptAnalysis(buildStructureAndAnalysePrompt(rawText, 'en'))
  const { structured_data: structuredRaw, analysis: enAnalysis } = parsed

  const reportDate  = structuredRaw?.report_date ?? null
  const reportTitle = enAnalysis.report_title ?? null
  const testsArray  = Array.isArray(structuredRaw?.tests) ? structuredRaw.tests
                    : Array.isArray(structuredRaw) ? structuredRaw
                    : []

  await supabase
    .from('reports')
    .update({ structured_data: testsArray, report_date: reportDate, report_title: reportTitle })
    .eq('id', reportId)

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

  if (analysisErr) throw new Error(`Analysis insert failed: ${analysisErr.message}`)

  // 'done' only once the analysis row exists — 'done' with no analysis would
  // leave the report page blank (no spinner, no error).
  await supabase.from('reports').update({ status: 'done' }).eq('id', reportId)

  return { analysis: analysisRow, report_title: reportTitle, report_date: reportDate }
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

  // Checked against this process, not the DB row: two requests arriving
  // together both read the row before either marks it 'processing'.
  if (inFlight.has(reportId)) {
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

  // 2. Mark as processing — claim it in-process first so a second request
  //    arriving during the DB write sees it as in flight.
  inFlight.add(reportId)
  await supabase
    .from('reports')
    .update({ status: 'processing' })
    .eq('id', reportId)

  try {
    const result = await runAnalysisPipeline(reportId, report.file_type, report.file_url)
    return res.json(result)
  } catch (err) {
    console.error('Pipeline error:', err.message)
    await supabase.from('reports').update({ status: 'failed' }).eq('id', reportId)
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

  // The report's real status: 'processing' must not read as 'pending', or the
  // client starts a second analysis, gets a 409 and shows "analysis failed".
  // An orphaned 'processing' (see inFlight), or a 'done' row whose analysis
  // never got saved, reads as 'pending' so the client re-runs it.
  const orphaned = (report.status === 'processing' && !inFlight.has(reportId)) || report.status === 'done'
  const status = orphaned ? 'pending' : report.status
  return res.json({ status, analysis: null, report_title: null, report_date: null })
}
