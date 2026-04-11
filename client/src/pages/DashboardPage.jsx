import { useEffect, useRef } from 'react'
import logo from '../assets/logo.svg'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useReports } from '../hooks/useReports'
import UploadZone from '../components/UploadZone'
import ReportCard from '../components/ReportCard'
import ChatPanel from '../components/ChatPanel'
import LangToggle from '../components/LangToggle'
import healthFacts from '../data/healthFacts'

// ── Fact picker ──────────────────────────────────────────────────────
function pickFact() {
  const lastIdx = parseInt(localStorage.getItem('lastHealthFactIdx') ?? '-1', 10)
  let idx
  do { idx = Math.floor(Math.random() * healthFacts.length) } while (idx === lastIdx && healthFacts.length > 1)
  localStorage.setItem('lastHealthFactIdx', String(idx))
  return healthFacts[idx]
}

// ── Standalone welcome audio — independent of useVoice state ─────────
async function playWelcomeVoice(text, lang) {
  console.log('[Welcome] playWelcomeVoice called, text:', text, 'lang:', lang)

  let audioCtx
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    console.log('[Welcome] AudioContext created, state:', audioCtx.state)
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume()
      console.log('[Welcome] AudioContext resumed')
    }
  } catch (e) {
    console.warn('[Welcome] AudioContext failed:', e)
    return
  }

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const wsUrl = `${protocol}://${window.location.host}/ws/tts`
  console.log('[Welcome] Opening WS to', wsUrl)

  const ws = new WebSocket(wsUrl)
  ws.binaryType = 'arraybuffer'

  const chunks = []
  let played = false

  function playChunks() {
    if (played) return
    if (chunks.length === 0) { console.warn('[Welcome] done/close fired but 0 chunks'); return }
    played = true

    const total = chunks.reduce((s, c) => s + c.length, 0)
    const merged = new Uint8Array(total)
    let offset = 0
    for (const c of chunks) { merged.set(c, offset); offset += c.length }

    console.log('[Welcome] Decoding', total, 'bytes across', chunks.length, 'chunks')
    audioCtx.decodeAudioData(merged.buffer.slice(0))
      .then((buffer) => {
        const source = audioCtx.createBufferSource()
        source.buffer = buffer
        source.connect(audioCtx.destination)
        source.onended = () => {
          console.log('[Welcome] Playback ended')
          audioCtx.close()
        }
        source.start(0)
        console.log('[Welcome] Playback started, duration:', buffer.duration.toFixed(2), 's')
      })
      .catch((e) => console.warn('[Welcome] decodeAudioData failed:', e))
  }

  ws.onopen = () => {
    console.log('[Welcome] WS opened, sending speak request')
    ws.send(JSON.stringify({ type: 'speak', text, lang }))
  }

  ws.onmessage = (e) => {
    if (e.data instanceof ArrayBuffer) {
      chunks.push(new Uint8Array(e.data))
      console.log('[Welcome] audio chunk:', e.data.byteLength, 'bytes, total chunks:', chunks.length)
      return
    }
    try {
      const msg = JSON.parse(e.data.toString())
      console.log('[Welcome] JSON from server:', msg.type)
      if (msg.type === 'done') { playChunks(); ws.close() }
      else if (msg.type === 'error') { console.warn('[Welcome] server TTS error'); ws.close() }
    } catch {}
  }

  ws.onclose = (e) => {
    console.log('[Welcome] WS closed, code:', e.code, 'played:', played, 'chunks:', chunks.length)
    if (!played && chunks.length > 0) playChunks()
  }

  ws.onerror = (e) => console.warn('[Welcome] WS error:', e)
}

// ── Dashboard ────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const { language } = useLanguage()
  const { reports, loading, error, upload, deleteReport } = useReports()

  const hasDoneReports = reports.some((r) => r.status === 'done')

  // Refs so the listener closure always has fresh values without re-registering
  const greetingRef = useRef(null)
  const langRef     = useRef(null)
  const firedRef    = useRef(false)

  useEffect(() => {
    // Only prepare once per session
    if (sessionStorage.getItem('welcomePlayed')) return
    // Wait until user is available
    if (!user) return

    const fact = pickFact()
    const firstName = user.name?.split(' ')[0]
    greetingRef.current = firstName
      ? `Welcome back ${firstName}. Did you know — ${fact}`
      : `Did you know — ${fact}`
    langRef.current = language === 'hi' ? 'hi-IN' : 'en-IN'

    console.log('[Welcome] Greeting prepared:', greetingRef.current)
    console.log('[Welcome] Waiting for first user interaction (autoplay policy)')

    function onFirstInteraction() {
      if (firedRef.current) return
      firedRef.current = true
      sessionStorage.setItem('welcomePlayed', '1')
      document.removeEventListener('click', onFirstInteraction, true)
      document.removeEventListener('touchstart', onFirstInteraction, true)
      console.log('[Welcome] First interaction — firing playWelcomeVoice')
      playWelcomeVoice(greetingRef.current, langRef.current).catch((e) => {
        console.warn('[Welcome] playWelcomeVoice threw:', e)
      })
    }

    document.addEventListener('click', onFirstInteraction, true)
    document.addEventListener('touchstart', onFirstInteraction, true)

    return () => {
      document.removeEventListener('click', onFirstInteraction, true)
      document.removeEventListener('touchstart', onFirstInteraction, true)
    }
  }, [user])

  return (
    <div className="min-h-screen bg-surface font-sans">
      {/* Top navbar */}
      <header className="bg-card border-b border-ink-200/60 px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center">
          <img src={logo} alt="Meditrack" className="h-7" />
        </div>
        <div className="flex items-center gap-3">
          <LangToggle />
          <span className="text-[14px] font-medium text-ink-400 hidden sm:block">{user?.phone_number}</span>
          <button
            onClick={logout}
            className="text-[14px] font-semibold text-ink-600 border border-ink-200 rounded-xl px-4 py-2 hover:bg-surface hover:text-ink-900 transition-colors"
          >
            {t('logout')}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {user?.name && (
          <div>
            <h2 className="text-3xl font-bold text-ink-900">
              {t('hello')}, {user.name} 👋
            </h2>
            <p className="text-[15px] text-ink-400 mt-1 font-medium">{t('health_dashboard')}</p>
          </div>
        )}

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-400 mb-4">
            {t('upload_report_section')}
          </h2>
          <UploadZone onUpload={upload} />
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-400 mb-4">
            {t('ask_about_reports')}
          </h2>
          {!loading && !hasDoneReports ? (
            <div className="bg-card rounded-2xl border border-ink-200/60 shadow-sm px-6 py-8 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-50 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgb(199, 243, 108)" className="w-6 h-6">
                  <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.17l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.17 48.9 48.9 0 0 1-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97Z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-[15px] font-medium text-ink-600">{t('upload_first')}</p>
            </div>
          ) : (
            <ChatPanel />
          )}
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-400 mb-4">
            {t('your_reports')}
          </h2>
          {loading ? (
            <div className="flex items-center gap-3 py-4">
              <div className="w-5 h-5 border-2 border-ink-200 border-t-teal-600 rounded-full animate-spin" />
              <p className="text-[15px] text-ink-400 font-medium">{t('loading')}</p>
            </div>
          ) : error ? (
            <p className="text-[15px] text-red-500 font-medium">{error}</p>
          ) : reports.length === 0 ? (
            <p className="text-[15px] text-ink-400 font-medium">{t('no_reports')}</p>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <ReportCard key={r.id} report={r} onDelete={deleteReport} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
