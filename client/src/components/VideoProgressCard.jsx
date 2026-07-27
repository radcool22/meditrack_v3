import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import VideoModal from './VideoModal'
import axios from '../utils/axios'

const STAGES = [
  'Reading your report',
  'Generating script',
  'Creating voice narration',
  'Rendering video frames',
  'Finalising your video',
]
const STAGE_SECS = 30 // seconds each of stages 0-3

export default function VideoProgressCard() {
  const { token } = useAuth()
  const navigate  = useNavigate()

  const [isMobile,   setIsMobile]   = useState(() => window.innerWidth < 640)
  const [visible,    setVisible]    = useState(false)
  const [minimized,  setMinimized]  = useState(false)
  const [status,     setStatus]     = useState('generating') // 'generating' | 'ready' | 'failed'
  const [videoUrl,   setVideoUrl]   = useState(null)
  const [reportId,   setReportId]   = useState(null)
  const [elapsed,    setElapsed]    = useState(0) // seconds since card activated
  const [showModal,  setShowModal]  = useState(false)

  // Track viewport width for responsive layout
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Ref mirrors visible so interval callbacks see the latest value without re-creating intervals
  const visibleRef = useRef(false)
  useEffect(() => { visibleRef.current = visible }, [visible])

  function activate(id) {
    visibleRef.current = true // guard immediately — don't wait for state flush
    setReportId(id)
    setStatus('generating')
    setElapsed(0)
    setMinimized(window.innerWidth < 640) // collapsed by default on mobile
    setVideoUrl(null)
    setVisible(true)
  }

  function dismiss() {
    visibleRef.current = false
    setVisible(false)
    setReportId(null)
    setStatus('generating')
    setElapsed(0)
    setVideoUrl(null)
  }

  // ── Discovery poll ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return
    async function discover() {
      if (visibleRef.current) return
      try {
        const { data } = await axios.get('/api/reports', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const gen = data.reports?.find(r => r.video_status === 'generating')
        if (gen) activate(gen.id)
      } catch {}
    }
    discover()
    const id = setInterval(discover, 5000)
    return () => clearInterval(id)
  }, [token])

  // ── Status poll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible || !reportId || !token || status !== 'generating') return
    async function poll() {
      try {
        const { data } = await axios.get(
          `/api/reports/${reportId}/video-status`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        if (data.videoStatus === 'ready') {
          setStatus('ready')
          setVideoUrl(data.videoUrl ?? null)
        } else if (data.videoStatus === 'failed') {
          setStatus('failed')
        } else if (!data.videoStatus || data.videoStatus === 'none') {
          dismiss()
        }
      } catch {}
    }
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [visible, reportId, token, status])

  // ── Cosmetic stage timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible || status !== 'generating') return
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [visible, status])

  if (!visible) return null

  const currentStage = Math.min(Math.floor(elapsed / STAGE_SECS), 4)
  const stageFrac    = currentStage < 4 ? (elapsed % STAGE_SECS) / STAGE_SECS : null
  const isReady      = status === 'ready'
  const isFailed     = status === 'failed'
  const isDone       = isReady || isFailed

  const headerBg    = isReady ? '#16a34a' : isFailed ? '#dc2626' : 'rgb(52,120,247)'
  const headerLabel = isReady ? 'Video Ready!' : isFailed ? 'Generation Failed' : 'Generating Video...'

  const containerStyle = isMobile ? {
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
    borderRadius: '16px 16px 0 0', background: 'white',
    boxShadow: '0 -4px 24px rgba(0,0,0,0.14)',
    overflow: 'hidden', fontFamily: 'inherit',
  } : {
    position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
    width: 304, borderRadius: 16, background: 'white',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)',
    overflow: 'hidden', fontFamily: 'inherit',
  }

  return (
    <>
      <style>{`
        @keyframes vpcspin  { to { transform: rotate(360deg) } }
        @keyframes vpcpulse { 0%,100% { width:18%; opacity:.55 } 50% { width:68%; opacity:1 } }
      `}</style>

      <div style={containerStyle}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div
          style={{
            background: headerBg, padding: '11px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: isMobile && !isDone ? 'pointer' : 'default',
          }}
          onClick={isMobile && !isDone ? () => setMinimized(m => !m) : undefined}
        >
          <span style={{ color: 'white', fontWeight: 700, fontSize: 13, letterSpacing: '-0.01em' }}>
            {headerLabel}
          </span>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {!isDone && (
              <button
                onClick={(e) => { e.stopPropagation(); setMinimized(m => !m) }}
                aria-label={minimized ? 'Expand' : 'Collapse'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px 4px', color: 'rgba(255,255,255,0.85)', lineHeight: 0 }}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16, transition: 'transform 0.2s', transform: minimized ? 'rotate(180deg)' : 'none' }}>
                  <path fillRule="evenodd" d="M9.47 6.47a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 1 1-1.06 1.06L10 8.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06l4.25-4.25z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            {isDone && (
              <button
                onClick={dismiss}
                aria-label="Close"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px', color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: 700, lineHeight: 1 }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        {!minimized && (
          <div style={{ padding: '14px 14px 16px' }}>
            {isDone ? (
              isReady ? (
                <button
                  onClick={() => setShowModal(true)}
                  style={{
                    width: '100%', background: '#16a34a', color: 'white',
                    border: 'none', borderRadius: 10, padding: '10px 0',
                    fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  }}
                >
                  Watch Now
                </button>
              ) : (
                <button
                  onClick={() => { navigate('/dashboard'); dismiss() }}
                  style={{
                    width: '100%', background: '#dc2626', color: 'white',
                    border: 'none', borderRadius: 10, padding: '10px 0',
                    fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  }}
                >
                  Try Again
                </button>
              )
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {STAGES.map((label, i) => {
                  const done    = i < currentStage
                  const current = i === currentStage

                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ width: 18, height: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {done ? (
                            <svg viewBox="0 0 20 20" fill="#16a34a" style={{ width: 18, height: 18 }}>
                              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                            </svg>
                          ) : current ? (
                            <div style={{
                              width: 16, height: 16, borderRadius: '50%',
                              border: '2.5px solid rgba(52,120,247,0.22)',
                              borderTop: '2.5px solid rgb(52,120,247)',
                              animation: 'vpcspin 0.75s linear infinite',
                            }} />
                          ) : (
                            <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #d1d5db' }} />
                          )}
                        </div>

                        <span style={{
                          fontSize: 13,
                          fontWeight: current ? 600 : 400,
                          color: done ? '#16a34a' : current ? '#111827' : '#9ca3af',
                        }}>
                          {label}
                        </span>
                      </div>

                      {current && (
                        <div style={{ marginLeft: 27, marginTop: 5 }}>
                          <div style={{ height: 3, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
                            {i < 4 ? (
                              <div style={{
                                height: '100%', borderRadius: 2,
                                background: 'rgb(52,120,247)',
                                width: `${(stageFrac ?? 0) * 100}%`,
                                transition: 'width 1s linear',
                              }} />
                            ) : (
                              <div style={{
                                height: '100%', borderRadius: 2,
                                background: 'rgb(52,120,247)',
                                animation: 'vpcpulse 2s ease-in-out infinite',
                              }} />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rendered outside the overflow:hidden card so it covers the full viewport */}
      {showModal && videoUrl && (
        <VideoModal src={videoUrl} onClose={() => setShowModal(false)} />
      )}
    </>
  )
}
