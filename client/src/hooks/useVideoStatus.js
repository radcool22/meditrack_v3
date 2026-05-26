import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

const POLL_INTERVAL_MS = 5000
const MAX_POLLS = 60 // 5 minutes (60 × 5s)

export function useVideoStatus(reportId) {
  const { token } = useAuth()
  const [videoStatus, setVideoStatus] = useState('none')
  const [videoUrl, setVideoUrl]       = useState(null)
  const [videoError, setVideoError]   = useState(null)
  const pollRef   = useRef(null)
  const pollCount = useRef(0)

  const headers = { Authorization: `Bearer ${token}` }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    pollCount.current = 0
  }

  async function fetchStatus() {
    try {
      const { data } = await axios.get(`/api/reports/${reportId}/video-status`, { headers })
      setVideoStatus(data.videoStatus)
      setVideoUrl(data.videoUrl   ?? null)
      setVideoError(data.videoError ?? null)
    } catch (err) {
      console.error('Video status poll error:', err.message)
      // Transient network errors don't stop polling — only terminal statuses do
    }
  }

  function beginPolling() {
    if (pollRef.current) return // already running
    pollCount.current = 0
    pollRef.current = setInterval(() => {
      pollCount.current += 1
      if (pollCount.current >= MAX_POLLS) {
        stopPolling()
        setVideoStatus('failed')
        setVideoError('timeout')
        return
      }
      fetchStatus()
    }, POLL_INTERVAL_MS)
  }

  // Fetch once on mount — if the DB already has 'generating', the status useEffect
  // below will call beginPolling() automatically on the next render.
  useEffect(() => {
    if (!reportId || !token) return
    setVideoStatus('none')
    setVideoUrl(null)
    setVideoError(null)
    stopPolling()
    fetchStatus()
    return () => stopPolling()
  }, [reportId, token])

  // Central gating: start or stop polling whenever videoStatus changes
  useEffect(() => {
    if (videoStatus === 'generating' && !pollRef.current) {
      beginPolling()
    }
    if ((videoStatus === 'ready' || videoStatus === 'failed') && pollRef.current) {
      stopPolling()
    }
  }, [videoStatus])

  // Called by the page immediately after a successful POST /generate-video response,
  // so polling starts right away without waiting for the first 5s tick.
  function notifyGenerating() {
    setVideoStatus('generating')
  }

  // Called by the page when it already knows the initial status from a parent data
  // load (e.g. the reports list on DashboardPage). Jumps straight to that status
  // without waiting for the mount fetchStatus() to complete — if the status is
  // 'generating', beginPolling() fires on the next render via the useEffect above.
  function startPolling(initialStatus, initialUrl = null) {
    setVideoStatus(initialStatus)
    setVideoUrl(initialUrl)
    setVideoError(null)
  }

  return { videoStatus, videoUrl, videoError, notifyGenerating, startPolling }
}
