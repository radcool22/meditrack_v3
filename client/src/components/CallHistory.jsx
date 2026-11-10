import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchCalls, fetchCall, formatDuration, CALLS_CHANGED_EVENT } from '../utils/callApi'

const SHOWN = 3

const STATUS_LABEL = {
  calling:   { text: 'Calling…',      className: 'bg-teal-50 text-teal-900' },
  no_answer: { text: 'Missed',        className: 'bg-ink-100 text-ink-600' },
  busy:      { text: 'Line busy',     className: 'bg-ink-100 text-ink-600' },
  failed:    { text: "Didn't connect", className: 'bg-ink-100 text-ink-600' },
}

// Phone with a small arrow: out (MediTrack called you) or in (you called).
function CallIcon({ inbound }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
      {inbound ? <path d="M22 2l-6 6M16 3v5h5" /> : <path d="M16 8l6-6M17 2h5v5" />}
    </svg>
  )
}

function when(iso) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

function CallRow({ call, token }) {
  const [open, setOpen] = useState(false)
  const [transcript, setTranscript] = useState(null)
  const [loadingTranscript, setLoadingTranscript] = useState(false)
  const done = call.status === 'completed'
  const badge = STATUS_LABEL[call.status]

  async function showTranscript() {
    setLoadingTranscript(true)
    try {
      const full = await fetchCall(call.id, token)
      setTranscript(full?.transcript ?? [])
    } catch {
      setTranscript([])
    } finally {
      setLoadingTranscript(false)
    }
  }

  return (
    <li className="bg-card border border-ink-200/60 rounded-2xl shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full text-left px-5 py-4 flex items-center gap-3"
      >
        <span
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${done ? 'text-ink-900' : 'bg-ink-100 text-ink-400'}`}
          style={done ? { background: 'rgba(199,243,108,0.45)' } : undefined}
        >
          <CallIcon inbound={call.direction === 'inbound'} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-semibold text-ink-900">
            {call.direction === 'inbound' ? 'You called MediTrack' : 'MediTrack called you'}
          </span>
          <span className="block text-[13px] text-ink-400 mt-0.5">
            {when(call.created_at)}{done && call.duration_sec ? ` · ${formatDuration(call.duration_sec)}` : ''}
          </span>
          {done && call.summary && !open && (
            <span className="block text-[13px] text-ink-600 mt-1 truncate">{call.summary}</span>
          )}
        </span>
        {call.urgent && <span className="text-[12px] font-semibold px-2 py-1 rounded-lg bg-red-50 text-red-700 shrink-0">See a doctor</span>}
        {badge && <span className={`text-[12px] font-semibold px-2 py-1 rounded-lg shrink-0 ${badge.className}`}>{badge.text}</span>}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 text-ink-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true">
          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-4 -mt-1">
          {done ? (
            <>
              <p className="text-[15px] text-ink-600 leading-relaxed">
                {call.summary ?? 'The summary for this call is still being written.'}
              </p>
              {transcript === null ? (
                <button
                  onClick={showTranscript}
                  disabled={loadingTranscript}
                  className="mt-3 text-[14px] font-semibold text-accent-500 hover:text-accent-600 transition-colors"
                >
                  {loadingTranscript ? 'Loading…' : 'Show what was said'}
                </button>
              ) : transcript.length ? (
                <div className="mt-3 space-y-2 border-t border-ink-200/60 pt-3 max-h-80 overflow-y-auto">
                  {transcript.map((t, i) => (
                    <p key={i} className="text-[14px] leading-snug">
                      <span className="font-semibold text-ink-900">{t.role === 'agent' ? 'MediTrack' : 'You'}: </span>
                      <span className="text-ink-600">{t.text}</span>
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-[13px] text-ink-400">No transcript was saved for this call.</p>
              )}
            </>
          ) : (
            <p className="text-[14px] text-ink-400">
              {call.status === 'calling' ? 'This call is still in progress.' : 'Nothing was said on this call.'}
            </p>
          )}
        </div>
      )}
    </li>
  )
}

// "Your calls": past calls with their summaries. Hidden until the first call.
export default function CallHistory() {
  const { token } = useAuth()
  const [calls, setCalls] = useState([])
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(() => {
    if (!token) return
    fetchCalls(token).then(setCalls).catch(() => {})
  }, [token])

  useEffect(() => {
    load()
    window.addEventListener(CALLS_CHANGED_EVENT, load)
    return () => window.removeEventListener(CALLS_CHANGED_EVENT, load)
  }, [load])

  if (!calls.length) return null
  const shown = showAll ? calls : calls.slice(0, SHOWN)

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-400 mb-4">Your calls</h2>
      <ul className="space-y-3">
        {shown.map((c) => <CallRow key={c.id} call={c} token={token} />)}
      </ul>
      {calls.length > SHOWN && (
        <button
          onClick={() => setShowAll((s) => !s)}
          className="mt-3 text-[14px] font-semibold text-accent-500 hover:text-accent-600 transition-colors"
        >
          {showAll ? 'Show fewer' : `Show all ${calls.length} calls`}
        </button>
      )}
    </section>
  )
}
