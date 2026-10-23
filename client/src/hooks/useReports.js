import { useState, useEffect, useCallback } from 'react'
import axios from '../utils/axios'
import { useAuth } from '../context/AuthContext'
import { friendly } from '../utils/friendlyError'

export function useReports() {
  const { token } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const authHeaders = { Authorization: `Bearer ${token}` }

  const fetchReports = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await axios.get('/api/reports', { headers: authHeaders })
      setReports(data.reports)
    } catch {
      setError(friendly('your reports not loading'))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token) fetchReports()
  }, [fetchReports, token])

  // Trigger analysis for a single report and update its status in state
  const triggerAnalysis = useCallback(async (reportId) => {
    // Mark done — with the title and date the analysis extracted, so the card
    // doesn't show the raw file name and "Date unknown" until a refresh.
    const markDone = (data) => setReports((prev) =>
      prev.map((r) => (r.id === reportId
        ? { ...r, status: 'done', report_title: data.report_title ?? r.report_title, report_date: data.report_date ?? r.report_date }
        : r))
    )
    const markFailed = () => setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, status: 'failed' } : r))
    )

    try {
      const { data } = await axios.post(`/api/analysis/${reportId}`, {}, { headers: authHeaders })
      markDone(data)
    } catch (err) {
      if (err.response?.status !== 409) { markFailed(); return }
      // 409: the report page is already analysing it — wait for that run.
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 3000))
        try {
          const { data } = await axios.get(`/api/analysis/${reportId}`, { headers: authHeaders })
          if (data.status === 'done' && data.analysis) { markDone(data); return }
          if (data.status === 'failed') { markFailed(); return }
        } catch { /* transient — keep waiting */ }
      }
      markFailed()
    }
  }, [token])

  async function upload(file, onProgress) {
    const form = new FormData()
    form.append('report', file)
    const { data } = await axios.post('/api/reports/upload', form, {
      headers: { ...authHeaders, 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress) onProgress(Math.round((e.loaded * 100) / e.total))
      },
    })
    const report = data.report
    // Add as 'processing' immediately so the spinner shows
    setReports((prev) => [{ ...report, status: 'processing' }, ...prev])
    // Fire analysis in background — no await
    triggerAnalysis(report.id)
    return report
  }

  async function deleteReport(id) {
    await axios.delete(`/api/reports/${id}`, { headers: authHeaders })
    setReports((prev) => prev.filter((r) => r.id !== id))
  }

  return { reports, loading, error, upload, deleteReport, refetch: fetchReports }
}
