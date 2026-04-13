import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
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
    try {
      await axios.post(`/api/analysis/${reportId}`, {}, { headers: authHeaders })
      // Mark done
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: 'done' } : r))
      )
    } catch {
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: 'failed' } : r))
      )
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
