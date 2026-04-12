import supabase from '../services/supabase.js'

const MIME_TO_TYPE = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'application/pdf': 'pdf',
}

export async function uploadReport(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' })
  }

  const { userId } = req.user
  const { originalname, mimetype, buffer } = req.file
  const fileType = MIME_TO_TYPE[mimetype]
  const storagePath = `${userId}/${Date.now()}-${originalname}`

  const { error: storageError } = await supabase.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET)
    .upload(storagePath, buffer, { contentType: mimetype })

  if (storageError) {
    console.error('Storage upload error:', storageError.message)
    return res.status(500).json({ error: 'Failed to upload file' })
  }

  const { data: urlData } = supabase.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET)
    .getPublicUrl(storagePath)

  const fileUrl = urlData.publicUrl

  const { data: report, error: dbError } = await supabase
    .from('reports')
    .insert({
      user_id:   userId,
      file_name: originalname,
      file_url:  fileUrl,
      file_type: fileType,
      status:    'pending',
    })
    .select('id, file_name, file_url, file_type, status, uploaded_at, report_date, report_title')
    .single()

  if (dbError) {
    console.error('DB insert error:', dbError.message)
    return res.status(500).json({ error: 'Failed to save report metadata' })
  }

  return res.status(201).json({ report })
}

export async function getReports(req, res) {
  const { userId } = req.user

  const { data: reports, error } = await supabase
    .from('reports')
    .select('id, file_name, file_url, file_type, status, uploaded_at, report_date, report_title')
    .eq('user_id', userId)
    .order('uploaded_at', { ascending: false })

  if (error) {
    console.error('Get reports error:', error.message)
    return res.status(500).json({ error: 'Failed to fetch reports' })
  }

  return res.json({ reports })
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
