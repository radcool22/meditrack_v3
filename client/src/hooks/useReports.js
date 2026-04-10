import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

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
      setError('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token) fetchReports()
  }, [fetchReports, token])

  async function upload(file, onProgress) {
    const form = new FormData()
    form.append('report', file)
    const { data } = await axios.post('/api/reports/upload', form, {
      headers: { ...authHeaders, 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress) onProgress(Math.round((e.loaded * 100) / e.total))
      },
    })
    setReports((prev) => [data.report, ...prev])
    return data.report
  }

  async function deleteReport(id) {
    await axios.delete(`/api/reports/${id}`, { headers: authHeaders })
    setReports((prev) => prev.filter((r) => r.id !== id))
  }

  return { reports, loading, error, upload, deleteReport, refetch: fetchReports }
}
