import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { requestCall, fetchCall, fetchCalls, callErrorMessage, announceCallsChanged } from '../utils/callApi'

const POLL_INTERVAL_MS = 4000
// Matches the server's 15-minute stale-'calling' window, plus a margin.
const MAX_POLLS = 270
// The summary is written a few seconds after the call ends — wait this many polls for it.
const SUMMARY_POLLS = 8

// One "Call me" flow: idle → (consent) → starting → calling → ended.
// reportId is the report the call is about, or null for a general call.
export function useCall(reportId = null) {
  const { token } = useAuth()
  const { language } = useLanguage()
  const [phase, setPhase] = useState('idle')
  const [call, setCall]   = useState(null)   // the call row once it has ended
  const [error, setError] = useState('')
  const [from, setFrom]   = useState('')     // the number MediTrack calls from
  const pollRef  = useRef(null)
  const pollsRef = useRef(0)

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  function watch(callId) {
    stopPolling()
    pollsRef.current = 0
    let summaryPolls = 0
    setPhase('calling')
    pollRef.current = setInterval(async () => {
      pollsRef.current += 1
      try {
        const row = await fetchCall(callId, token)
        if (row && row.status !== 'calling') {
          setCall(row)
          setPhase('ended')
          const waitingForSummary = row.status === 'completed' && !row.summary && ++summaryPolls < SUMMARY_POLLS
          if (!waitingForSummary) {
            stopPolling()
            announceCallsChanged()
          }
          return
        }
      } catch {
        // Transient network errors don't stop polling
      }
      if (pollsRef.current >= MAX_POLLS) {
        stopPolling()
        setCall({ status: 'failed' })
        setPhase('ended')
      }
    }, POLL_INTERVAL_MS)
  }

  // A call still ringing from before a page refresh is picked up again.
  useEffect(() => {
    if (!token) return
    let cancelled = false
    fetchCalls(token)
      .then((calls) => {
        const live = calls.find((c) => c.direction === 'outbound' && c.status === 'calling' && (c.report_id ?? null) === reportId)
        if (live && !cancelled) watch(live.id)
      })
      .catch(() => {})
    return () => { cancelled = true; stopPolling() }
  }, [token, reportId])

  async function place(consent) {
    setError('')
    setPhase('starting')
    const result = await requestCall({ reportId, language, consent }, token)
    if (result.ok) { setFrom(result.from ?? ''); return watch(result.callId) }
    if (result.code === 'consent_required') return setPhase('consent')
    setError(callErrorMessage(result.code))
    setPhase('idle')
  }

  return {
    phase,
    call,
    error,
    from,
    start:          () => place(false),
    confirmConsent: () => place(true),
    cancelConsent:  () => setPhase('idle'),
    reset:          () => { setCall(null); setError(''); setPhase('idle') },
  }
}
