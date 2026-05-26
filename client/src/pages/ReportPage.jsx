import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { useAnalysis } from '../hooks/useAnalysis'
import { useVoice } from '../hooks/useVoice'
import { useVideoStatus } from '../hooks/useVideoStatus'
import { useLanguage } from '../context/LanguageContext'
import LangToggle from '../components/LangToggle'
import ChatPanel from '../components/ChatPanel'
import VideoPlayer from '../components/VideoPlayer'
import AgeModal from '../components/AgeModal'

const FLAG_STYLES = {
  HIGH:     'bg-red-50 border-red-200',
  LOW:      'bg-amber-50 border-amber-200',
  ABNORMAL: 'bg-orange-50 border-orange-200',
}

const FLAG_VALUE_COLOR = {
  HIGH:     'text-red-600',
  LOW:      'text-amber-500',
  ABNORMAL: 'text-orange-500',
}

function formatDate(dateStr) {
  if (!dateStr) return 'Date unknown'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function Spinner({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-9 h-9 border-[3px] border-ink-200 border-t-teal-600 rounded-full animate-spin" />
      <p className="text-[15px] font-medium text-ink-400">{label}</p>
    </div>
  )
}

// ── Idle placeholder frame (before generation starts) ────────
function VideoIdleFrame() {
  return (
    <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-5 px-6 text-center"
      style={{ background: '#0a0e1a' }}>
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.08)' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="rgba(255,255,255,0.5)" className="w-8 h-8">
          <path d="M3.25 4A2.25 2.25 0 001 6.25v7.5A2.25 2.25 0 003.25 16h7.5A2.25 2.25 0 0013 13.75v-7.5A2.25 2.25 0 0010.75 4h-7.5zM19 4.75a.75.75 0 00-1.28-.53l-3 3a.75.75 0 00-.22.53v4.5c0 .199.079.39.22.53l3 3a.75.75 0 001.28-.53V4.75z" />
        </svg>
      </div>
      <div>
        <p className="text-[14px] font-semibold text-white/60">60-second Hindi video</p>
        <p className="text-[12px] text-white/35 mt-1 leading-relaxed">
          Tap Generate Video below to create a simple Hindi summary of this report
        </p>
      </div>
      <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest absolute top-4 left-4">
        Hindi Video Summary
      </span>
      <span className="text-[11px] font-extrabold absolute top-4 right-4" style={{ color: 'rgba(255,255,255,0.06)' }}>
        MediTrack
      </span>
    </div>
  )
}

// ── Generating state inside the frame ────────────────────────
function VideoGeneratingFrame() {
  return (
    <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-4 px-6 text-center"
      style={{ background: '#0a0e1a' }}>
      <div className="w-12 h-12 border-[3px] rounded-full animate-spin"
        style={{ borderColor: 'rgba(255,255,255,0.15)', borderTopColor: 'rgba(255,255,255,0.8)' }}
      />
      <p className="text-[13px] font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>
        Generating your Hindi video summary...
      </p>
      <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest absolute top-4 left-4">
        Hindi Video Summary
      </span>
      <span className="text-[11px] font-extrabold absolute top-4 right-4" style={{ color: 'rgba(255,255,255,0.06)' }}>
        MediTrack
      </span>
    </div>
  )
}

export default function ReportPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation()
  const autoSpeak = searchParams.get('autoSpeak') === '1'

  const { token } = useAuth()
  const { language } = useLanguage()
  const { analysis, reportTitle, reportDate, status, loading, error, retry } = useAnalysis(id)
  const { connect, speak } = useVoice()
  const { videoStatus, videoUrl, notifyGenerating } = useVideoStatus(id)
  const hasSpoken = useRef(false)

  const [ageModalOpen, setAgeModalOpen] = useState(false)

  async function handleAgeConfirm(ageYears) {
    setAgeModalOpen(false)
    try {
      await axios.post(
        `/api/reports/${id}/generate-video`,
        { ageYears },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      notifyGenerating()
    } catch (err) {
      console.error('Generate video failed:', err)
      // Session 3 will add error UI here
    }
  }

  useEffect(() => {
    if (!autoSpeak || !analysis?.summary || hasSpoken.current) return
    hasSpoken.current = true
    connect()
    speak(analysis.summary, language === 'hi' ? 'hi-IN' : 'en-IN')
  }, [autoSpeak, analysis?.summary])

  const isProcessing = status === 'processing' || (status === 'pending' && !analysis)

  return (
    <div className="min-h-screen bg-surface font-sans">

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="bg-card border-b border-ink-200/60 px-5 py-4 flex items-center gap-4 sticky top-0 z-10">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-[15px] font-semibold text-teal-700 hover:text-teal-900 transition-colors flex items-center gap-1.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10Z" clipRule="evenodd" />
          </svg>
          {t('back')}
        </button>
        <div className="w-px h-5 bg-ink-200" />
        <h1 className="text-xl font-bold text-ink-900 tracking-tight flex-1">
          {t('report_analysis')}
        </h1>
        <LangToggle />
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {loading && !analysis && <Spinner label={t('analysing')} />}
        {isProcessing && <Spinner label={t('analysing')} />}

        {error && !isProcessing && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-5 space-y-3">
            <p className="text-[15px] font-semibold text-red-700">{t('analysis_failed')}</p>
            <p className="text-[13px] text-red-600 font-mono break-all">{error}</p>
            <button
              onClick={retry}
              className="text-[14px] font-semibold bg-accent-500 hover:bg-accent-600 text-white px-5 py-2.5 rounded-xl transition-colors shadow-sm"
            >
              {t('retry_analysis')}
            </button>
          </div>
        )}

        {analysis && (
          <>
            {/* 1. Title + date */}
            <section className="bg-card border border-ink-200/60 rounded-2xl px-6 py-5 shadow-sm">
              <h2 className="text-[20px] font-bold text-ink-900 leading-snug">
                {reportTitle ?? t('report_analysis')}
              </h2>
              <p className="text-[13px] text-ink-400 font-medium mt-1">
                {formatDate(reportDate)}
              </p>
            </section>

            {/* 2. Summary */}
            <section className="bg-card border border-ink-200/60 rounded-2xl p-6 shadow-sm border-l-4 border-l-teal-500">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-400 mb-3">
                {t('summary')}
              </h2>
              <p className="text-[15px] text-ink-900 leading-relaxed">{analysis.summary}</p>
            </section>

            {/* ── 3. Video Summary section (above chat) ─────────── */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-ink-200/60" />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-400 shrink-0">
                  Video Summary
                </h2>
                <div className="flex-1 h-px bg-ink-200/60" />
              </div>

              {/* 9:16 frame — shown while idle or generating */}
              {videoStatus !== 'ready' && (
                <div className="w-full max-w-[360px] mx-auto relative" style={{ aspectRatio: '9 / 16' }}>
                  {videoStatus === 'none'       && <VideoIdleFrame />}
                  {videoStatus === 'generating' && <VideoGeneratingFrame />}
                </div>
              )}

              {/* Real video when ready */}
              {videoStatus === 'ready' && <VideoPlayer src={videoUrl} />}

              {/* Generate Video button — only when none */}
              {videoStatus === 'none' && (
                <button
                  onClick={() => setAgeModalOpen(true)}
                  className="mt-4 w-full max-w-[360px] mx-auto flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-semibold text-[15px] py-3.5 rounded-xl transition-colors shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                    <path d="M3.25 4A2.25 2.25 0 001 6.25v7.5A2.25 2.25 0 003.25 16h7.5A2.25 2.25 0 0013 13.75v-7.5A2.25 2.25 0 0010.75 4h-7.5zM19 4.75a.75.75 0 00-1.28-.53l-3 3a.75.75 0 00-.22.53v4.5c0 .199.079.39.22.53l3 3a.75.75 0 001.28-.53V4.75z" />
                  </svg>
                  Generate Video
                </button>
              )}
            </section>

            {/* 4. Chat */}
            <section>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-px bg-ink-200/60" />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-400 shrink-0">
                  {t('ask_about_report')}
                </h2>
                <div className="flex-1 h-px bg-ink-200/60" />
              </div>
              <ChatPanel
                reportId={id}
                isReportChat={true}
                greetingMessage={t('report_chat_greeting')}
              />
            </section>

            {/* 5a. Values that need attention */}
            {analysis.abnormal_values?.length > 0 && (
              <section className="bg-card border border-ink-200/60 rounded-2xl p-6 shadow-sm">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-400 mb-4">
                  {t('values_attention')}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {analysis.abnormal_values.map((item, i) => (
                    <div
                      key={i}
                      className="bg-black border border-black rounded-2xl p-4 flex flex-col shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-1 mb-2">
                        <span className="text-[12px] font-bold text-red-400 leading-tight flex-1">{item.test}</span>
                        <span className="text-[13px] font-bold shrink-0 text-white/70">
                          {item.flag === 'HIGH' ? '↑' : item.flag === 'LOW' ? '↓' : '!'}
                        </span>
                      </div>
                      <p className="text-[20px] font-extrabold leading-none mb-2 text-white">
                        {item.value}
                      </p>
                      <p className="text-[12px] text-white/70 leading-relaxed flex-1">
                        {item.plain_explanation}
                      </p>
                      {item.normal_range && (
                        <p className="text-[11px] text-white/50 font-medium mt-2">
                          {t('normal_range')} {item.normal_range}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 5b. All clear */}
            {analysis.abnormal_values?.length === 0 && (
              <section className="bg-teal-50 border border-teal-200 rounded-2xl px-5 py-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="rgb(199, 243, 108)" className="w-5 h-5">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143Z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-[15px] font-semibold text-teal-900">{t('all_clear')}</p>
              </section>
            )}

            {/* 5c. Suggestions */}
            {analysis.suggestions?.length > 0 && (
              <section className="bg-card border border-ink-200/60 rounded-2xl p-6 shadow-sm">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-400 mb-4">
                  {t('what_you_can_do')}
                </h2>
                <ul className="space-y-3">
                  {analysis.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-black text-white text-[12px] font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-[15px] text-ink-900 leading-relaxed">{s}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="py-6 text-center text-[12px] text-ink-400">
        <a
          href="https://www.meditrack.in/terms-of-use"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-ink-900 transition-colors"
        >
          Terms of Use
        </a>
      </footer>

      <AgeModal
        open={ageModalOpen}
        reportTitle={reportTitle}
        onConfirm={handleAgeConfirm}
        onClose={() => setAgeModalOpen(false)}
      />
    </div>
  )
}
