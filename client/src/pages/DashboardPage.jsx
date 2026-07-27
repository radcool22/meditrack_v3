import { useState, useEffect, useRef } from 'react'
import axios from '../utils/axios'
import logo from '../assets/logo.svg'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useReports } from '../hooks/useReports'
import { useVideoStatus } from '../hooks/useVideoStatus'
import UploadZone from '../components/UploadZone'
import ReportCard from '../components/ReportCard'
import ChatPanel from '../components/ChatPanel'
import LangToggle from '../components/LangToggle'
import VideoPlayer from '../components/VideoPlayer'

function formatReportDate(report) {
  if (report.report_date) {
    return new Date(report.report_date).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  }
  return 'Date unknown'
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const { user, token, logout } = useAuth()
  const { reports, loading, error, upload, deleteReport } = useReports()

  // Which report is currently being polled (one at a time)
  const [activeVideoReportId, setActiveVideoReportId] = useState(null)
  // Local overrides: { [reportId]: { status, url } } — takes precedence over DB state
  const [localVideoStates, setLocalVideoStates] = useState({})
  const [pickerOpen, setPickerOpen] = useState(false)
  const [playVideoReportId, setPlayVideoReportId] = useState(null)
  // Per-report generate attempt counter — reset on page refresh
  const [generateAttempts, setGenerateAttempts] = useState({})
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadingReportId, setUploadingReportId] = useState(null)

  const reportsRef = useRef(null)

  const { videoStatus, videoUrl, notifyGenerating } = useVideoStatus(activeVideoReportId)

  const hasDoneReports = reports.some((r) => r.status === 'done')
  const doneReports = reports.filter((r) => r.status === 'done')

  // Sync hook polling result into localVideoStates
  useEffect(() => {
    if (!activeVideoReportId || videoStatus === 'none') return
    setLocalVideoStates((prev) => ({
      ...prev,
      [activeVideoReportId]: { status: videoStatus, url: videoUrl },
    }))
    if (videoStatus === 'ready' || videoStatus === 'failed') {
      setActiveVideoReportId(null)
    }
  }, [activeVideoReportId, videoStatus, videoUrl])

  // Seed localVideoStates from the reports list on load (existing video state from DB)
  useEffect(() => {
    if (!reports.length) return
    setLocalVideoStates((prev) => {
      const fromDb = {}
      for (const r of reports) {
        const s = r.video_status ?? 'none'
        if (s !== 'none' && !prev[r.id]) {
          fromDb[r.id] = { status: s, url: r.video_url ?? null }
        }
      }
      return Object.keys(fromDb).length ? { ...fromDb, ...prev } : prev
    })
  }, [reports])

  // Reset upload progress bar once the newly uploaded report finishes processing
  useEffect(() => {
    if (!uploadingReportId) return
    const r = reports.find((r) => r.id === uploadingReportId)
    if (r?.status === 'done' || r?.status === 'failed') {
      setUploadProgress(0)
      setUploadingReportId(null)
    }
  }, [reports, uploadingReportId])

  // Effective video state per report: local override > DB state
  function getEffectiveVideo(report) {
    if (localVideoStates[report.id]) return localVideoStates[report.id]
    return { status: report.video_status ?? 'none', url: report.video_url ?? null }
  }

  async function handlePickerSelect(report) {
    setPickerOpen(false)
    if ((generateAttempts[report.id] ?? 0) >= 3) return
    setGenerateAttempts((prev) => ({ ...prev, [report.id]: (prev[report.id] ?? 0) + 1 }))
    setLocalVideoStates((prev) => ({ ...prev, [report.id]: { status: 'generating', url: null } }))
    try {
      await axios.post(
        `/api/reports/${report.id}/generate-video`,
        { ageYears: 25 },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      setActiveVideoReportId(report.id)
      notifyGenerating()
      reportsRef.current?.scrollIntoView({ behavior: 'smooth' })
    } catch (err) {
      console.error('Generate video failed:', err)
      setLocalVideoStates((prev) => { const n = { ...prev }; delete n[report.id]; return n })
    }
  }

  // Resolve video URL for the play popup
  const playingVideoUrl = (() => {
    if (!playVideoReportId) return null
    if (localVideoStates[playVideoReportId]?.url) return localVideoStates[playVideoReportId].url
    return reports.find((r) => r.id === playVideoReportId)?.video_url ?? null
  })()

  return (
    <div className="min-h-screen bg-surface font-sans">

      {/* ── Top navbar ─────────────────────────────────────────── */}
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

      {/* ── Main content ───────────────────────────────────────── */}
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {user?.name && (
          <div>
            <h2 className="text-3xl font-bold text-ink-900">
              {t('hello')}, {user.name} 👋
            </h2>
            <p className="text-[15px] text-ink-400 mt-1 font-medium">{t('health_dashboard')}</p>
          </div>
        )}

        <section id="upload-section">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-400 mb-4">
            {t('upload_report_section')}
          </h2>
          <UploadZone onUpload={async (file) => {
            setUploadProgress(1)
            try {
              const report = await upload(file, setUploadProgress)
              setUploadingReportId(report.id)
              reportsRef.current?.scrollIntoView({ behavior: 'smooth' })
            } catch {
              setUploadProgress(0)
            }
          }} />
          {uploadProgress > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] font-medium text-ink-400">
                  {uploadProgress === 100 ? 'Processing...' : 'Uploading...'}
                </span>
                <span className="text-[13px] font-semibold" style={{ color: 'rgb(52,120,247)' }}>
                  {uploadProgress}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-ink-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-150"
                  style={{ width: `${uploadProgress}%`, background: 'rgb(52,120,247)' }}
                />
              </div>
            </div>
          )}
        </section>

        {/* ── Generate Video card ─────────────────────────────── */}
        <button
          onClick={() => setPickerOpen(true)}
          className="w-full bg-card border border-ink-200/60 rounded-2xl px-5 py-4 flex items-center gap-4 hover:shadow-md transition-shadow text-left shadow-sm"
        >
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: '#EEF4FF' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#3478F7" className="w-5 h-5">
              <path d="M3.25 4A2.25 2.25 0 001 6.25v7.5A2.25 2.25 0 003.25 16h7.5A2.25 2.25 0 0013 13.75v-7.5A2.25 2.25 0 0010.75 4h-7.5zM19 4.75a.75.75 0 00-1.28-.53l-3 3a.75.75 0 00-.22.53v4.5c0 .199.079.39.22.53l3 3a.75.75 0 001.28-.53V4.75z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-ink-900">Generate Video Summary</p>
            <p className="text-[13px] text-ink-400 mt-0.5">60-second Hindi explanation of any report</p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-ink-400 shrink-0">
            <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </button>

        {/* ── Ask About Reports ───────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-400 mb-4">
            {t('ask_about_reports')}
          </h2>
          {!loading && !hasDoneReports ? (
            <div className="bg-card rounded-2xl border border-ink-200/60 shadow-sm px-6 py-8 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-50 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgb(199, 243, 108)" className="w-6 h-6">
                  <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97Z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-[15px] font-medium text-ink-600">{t('upload_first')}</p>
            </div>
          ) : (
            <ChatPanel />
          )}
        </section>

        {/* ── Your Reports ─────────────────────────────────────── */}
        <section ref={reportsRef}>
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
                <ReportCard
                  key={r.id}
                  report={r}
                  onDelete={deleteReport}
                  videoState={getEffectiveVideo(r).status}
                  onPlayVideo={() => setPlayVideoReportId(r.id)}
                />
              ))}
            </div>
          )}
        </section>
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


      {/* ── Report picker modal ────────────────────────────────── */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="bg-card rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[17px] font-bold text-ink-900 mb-1">
              Choose a report to generate a video for
            </h2>
            <p className="text-[13px] text-ink-400 mb-4">A 60-second Hindi summary will be created.</p>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto -mx-1 px-1">
              {doneReports.length === 0 ? (
                <p className="text-center text-[15px] text-ink-400 py-6">
                  No analysed reports yet. Upload and analyse a report first.
                </p>
              ) : (
                doneReports.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handlePickerSelect(r)}
                    className="w-full text-left p-4 rounded-xl border border-ink-200/60 hover:border-accent-500/50 hover:bg-surface transition-colors"
                  >
                    <p className="text-[15px] font-semibold text-ink-900 truncate">
                      {r.report_title ?? r.file_name}
                    </p>
                    <p className="text-[13px] text-ink-400 mt-0.5">{formatReportDate(r)}</p>
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => setPickerOpen(false)}
              className="mt-5 w-full text-center text-[14px] font-semibold text-ink-400 hover:text-ink-900 py-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Video playback popup ───────────────────────────────── */}
      {playVideoReportId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setPlayVideoReportId(null)}
        >
          <div
            className="relative w-full max-w-[360px]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setPlayVideoReportId(null)}
              className="absolute -top-11 right-0 flex items-center gap-1.5 text-white/70 hover:text-white text-[14px] font-semibold transition-colors"
            >
              <span>Close</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
            <VideoPlayer src={playingVideoUrl} />
          </div>
        </div>
      )}
    </div>
  )
}
