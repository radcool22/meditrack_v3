import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

export function useAnalysis(reportId) {
  const { token } = useAuth()
  const [analysis, setAnalysis] = useState(null)
  const [status, setStatus] = useState(null) // pending | processing | done | failed
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const pollRef = useRef(null)

  const headers = { Authorization: `Bearer ${token}` }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  async function trigger() {
    setError('')
    setStatus('processing')
    try {
      const { data } = await axios.post(`/api/analysis/${reportId}`, {}, { headers })
      setAnalysis(data.analysis)
      setStatus('done')
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Analysis failed'
      setError(msg)
      setStatus('failed')
    }
  }

  function retry() {
    trigger()
  }

  async function fetchStatus() {
    try {
      const { data } = await axios.get(`/api/analysis/${reportId}`, { headers })
      setStatus(data.status)
      if (data.analysis) {
        setAnalysis(data.analysis)
      }
      if (data.status === 'done' || data.status === 'failed') {
        stopPolling()
        setLoading(false)
      }
    } catch {
      stopPolling()
      setError('Failed to load analysis')
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!reportId || !token) return

    fetchStatus().then(() => {
      // status is set asynchronously — check after fetch
    })
    setLoading(false)

    return () => stopPolling()
  }, [reportId, token])

  // Start polling when status becomes processing
  useEffect(() => {
    if (status === 'processing' && !pollRef.current) {
      pollRef.current = setInterval(fetchStatus, 3000)
    }
    if ((status === 'done' || status === 'failed') && pollRef.current) {
      stopPolling()
      setLoading(false)
    }
  }, [status])

  // Auto-trigger analysis if report is pending (just uploaded, no analysis yet)
  useEffect(() => {
    if (status === 'pending' && analysis === null) {
      setStatus('processing')
      trigger()
    }
  }, [status])

  return { analysis, status, loading, error, retry }
}
