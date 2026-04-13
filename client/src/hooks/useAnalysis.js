import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { friendly } from '../utils/friendlyError'

export function useAnalysis(reportId) {
  const { token } = useAuth()
  const [analysis, setAnalysis]       = useState(null)
  const [reportTitle, setReportTitle] = useState(null)
  const [reportDate, setReportDate]   = useState(null)
  const [status, setStatus]           = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const pollRef = useRef(null)

  const headers = { Authorization: `Bearer ${token}` }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  async function trigger() {
    setError('')
    setStatus('processing')
    try {
      const { data } = await axios.post(`/api/analysis/${reportId}`, {}, { headers })
      setAnalysis(data.analysis)
      if (data.report_title) setReportTitle(data.report_title)
      if (data.report_date)  setReportDate(data.report_date)
      setStatus('done')
    } catch (err) {
      setError(friendly('the report analysis not completing'))
      setStatus('failed')
    }
  }

  function retry() { trigger() }

  async function fetchStatus() {
    try {
      const { data } = await axios.get(`/api/analysis/${reportId}`, { headers })
      setStatus(data.status)
      if (data.analysis)      setAnalysis(data.analysis)
      if (data.report_title)  setReportTitle(data.report_title)
      if (data.report_date)   setReportDate(data.report_date)
      if (data.status === 'done' || data.status === 'failed') {
        stopPolling()
        setLoading(false)
      }
    } catch {
      stopPolling()
      setError(friendly('the report analysis not loading'))
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!reportId || !token) return
    setAnalysis(null)
    setReportTitle(null)
    setReportDate(null)
    setStatus(null)
    setError('')
    setLoading(true)
    stopPolling()
    fetchStatus().then(() => {})
    setLoading(false)
    return () => stopPolling()
  }, [reportId, token])

  useEffect(() => {
    if (status === 'processing' && !pollRef.current) {
      pollRef.current = setInterval(fetchStatus, 3000)
    }
    if ((status === 'done' || status === 'failed') && pollRef.current) {
      stopPolling()
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    if (status === 'pending' && analysis === null) {
      setStatus('processing')
      trigger()
    }
  }, [status])

  return { analysis, reportTitle, reportDate, status, loading, error, retry }
}
