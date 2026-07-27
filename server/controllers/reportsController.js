import supabase from '../services/supabase.js'

const MIME_TO_TYPE = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'application/pdf': 'pdf',
}

export async function storeReportFile(userId, buffer, mimeType, fileName) {
  const fileType    = MIME_TO_TYPE[mimeType]
  const storagePath = `${userId}/${Date.now()}-${fileName}`

  const { error: storageError } = await supabase.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType })

  if (storageError) throw new Error(`Storage upload failed: ${storageError.message}`)

  const { data: urlData } = supabase.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET)
    .getPublicUrl(storagePath)

  const { data: report, error: dbError } = await supabase
    .from('reports')
    .insert({
      user_id:   userId,
      file_name: fileName,
      file_url:  urlData.publicUrl,
      file_type: fileType,
      status:    'pending',
    })
    .select('id, file_name, file_url, file_type, status, uploaded_at, report_date, report_title')
    .single()

  if (dbError) throw new Error(`DB insert failed: ${dbError.message}`)

  return report
}

export async function uploadReport(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file provided' })

  const { userId } = req.user
  const { originalname, mimetype, buffer } = req.file

  try {
    const report = await storeReportFile(userId, buffer, mimetype, originalname)
    return res.status(201).json({ report })
  } catch (err) {
    console.error('Upload error:', err.message)
    const msg = err.message.startsWith('Storage') ? 'Failed to upload file' : 'Failed to save report metadata'
    return res.status(500).json({ error: msg })
  }
}

const REPORTS_COLUMNS = [
  'id', 'file_name', 'file_url', 'file_type', 'status',
  'uploaded_at', 'report_date', 'report_title',
  'video_status', 'video_url', 'video_job_id',
  'video_requested_at', 'video_generated_at', 'video_error',
].join(', ')

export async function getReports(req, res) {
  console.log('getReports called for userId:', req.user?.userId)
  const { userId } = req.user
  console.log('[getReports] called — userId:', userId)

  async function querySupabase() {
    return supabase
      .from('reports')
      .select(REPORTS_COLUMNS)
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false })
  }

  try {
    let { data, error } = await querySupabase()
    console.log('Supabase response:', JSON.stringify(data), 'Error:', JSON.stringify(error))
    console.log('[getReports] attempt 1 — error:', error?.message ?? 'none', '| rows:', data?.length ?? 'null')

    if (error) {
      console.warn('[getReports] first attempt failed, retrying after 500ms:', { message: error.message, details: error.details, hint: error.hint, code: error.code })
      await new Promise((r) => setTimeout(r, 500))
      ;({ data, error } = await querySupabase())
      console.log('[getReports] attempt 2 — error:', error?.message ?? 'none', '| rows:', data?.length ?? 'null')
    }

    if (error) {
      console.error('[getReports] both attempts failed — full error:', JSON.stringify(error))
      return res.json({ reports: [] })
    }

    console.log('[getReports] raw response — row count:', data?.length ?? 0)

    const reports = (data ?? [])
      .filter((r) => {
        if (!r || !r.id || !r.file_name) {
          console.warn('[getReports] skipping malformed row:', JSON.stringify(r))
          return false
        }
        return true
      })
      .map((r) => ({
        ...r,
        video_status:       r.video_status       ?? null,
        video_url:          r.video_url          ?? null,
        video_job_id:       r.video_job_id       ?? null,
        video_requested_at: r.video_requested_at ?? null,
        video_generated_at: r.video_generated_at ?? null,
        video_error:        r.video_error        ?? null,
      }))

    console.log('[getReports] returning', reports.length, 'valid reports')
    return res.json({ reports })
  } catch (err) {
    console.error('[getReports] unexpected exception:', err)
    return res.json({ reports: [] })
  }
}

export async function deleteReport(req, res) {
  const { userId } = req.user
  const { id } = req.params

  const { data: report, error: fetchErr } = await supabase
    .from('reports')
    .select('id, file_url')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (fetchErr || !report) {
    return res.status(404).json({ error: 'Report not found' })
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET
  const prefix = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/`
  const storagePath = report.file_url.startsWith(prefix)
    ? report.file_url.slice(prefix.length)
    : null

  if (storagePath) {
    const { error: storageErr } = await supabase.storage.from(bucket).remove([storagePath])
    if (storageErr) console.error('Storage delete error:', storageErr.message)
  }

  const { error: dbErr } = await supabase.from('reports').delete().eq('id', id).eq('user_id', userId)
  if (dbErr) {
    console.error('Report delete error:', dbErr.message)
    return res.status(500).json({ error: 'Failed to delete report' })
  }

  return res.json({ success: true })
}

export async function getReport(req, res) {
  const { userId } = req.user
  const { id } = req.params

  const { data: report, error } = await supabase
    .from('reports')
    .select('id, file_name, file_url, file_type, status, uploaded_at, report_date, report_title, structured_data')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Get report error:', error.message)
    return res.status(500).json({ error: 'Failed to fetch report' })
  }

  if (!report) {
    return res.status(404).json({ error: 'Report not found' })
  }

  return res.json({ report })
}
