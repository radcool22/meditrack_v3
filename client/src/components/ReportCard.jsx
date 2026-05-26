import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { unlockAudio } from '../utils/sharedAudio'

function formatReportDate(report) {
  if (report.report_date) {
    return new Date(report.report_date).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  }
  return 'Date unknown'
}

const FILE_TYPE_BADGE = {
  pdf:  'bg-teal-100 text-ink-900',
  jpg:  'bg-amber-100 text-amber-500',
  jpeg: 'bg-amber-100 text-amber-500',
  png:  'bg-orange-100 text-coral-500',
}

// videoState: 'idle' | 'generating' | 'ready'
// onPlayVideo: () => void — called when user clicks Play video button
export default function ReportCard({ report, onDelete, videoState = 'idle', onPlayVideo }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const dateLabel = formatReportDate(report)
  const isProcessing = report.status === 'processing' || report.status === 'pending'
  const isDone = report.status === 'done'

  async function handleDelete(e) {
    e.stopPropagation()
    if (!confirming) { setConfirming(true); return }
    setDeleting(true)
    try {
      await onDelete(report.id)
    } catch {
      setDeleting(false)
      setConfirming(false)
    }
  }

  function handleCancelDelete(e) {
    e.stopPropagation()
    setConfirming(false)
  }

  const typeBadgeCls = FILE_TYPE_BADGE[report.file_type?.toLowerCase()] ?? 'bg-ink-200/50 text-ink-600'

  return (
    <div
      className="bg-card border border-ink-200/60 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
    >
      {/* ── Clickable row ─────────────────────────────────────── */}
      <div
        onClick={() => { if (!confirming) { unlockAudio(); navigate(`/report/${report.id}?autoSpeak=1`) } }}
        className="p-5 flex items-start justify-between gap-4 cursor-pointer"
      >
        {/* Left: badge + title + date */}
        <div className="flex items-start gap-3 min-w-0">
          <span className={`text-xs font-bold rounded-lg px-2.5 py-1 mt-0.5 shrink-0 uppercase tracking-wide ${typeBadgeCls}`}>
            {report.file_type}
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-ink-900 truncate">{report.report_title ?? report.file_name}</p>
            <p className="text-[13px] text-ink-400 mt-0.5 font-medium">{dateLabel}</p>
          </div>
        </div>

        {/* Right: status + action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {isProcessing && (
            <div className="w-4 h-4 border-2 border-ink-200 border-t-accent-500 rounded-full animate-spin" />
          )}
          {isDone && (
            <span className="text-[13px] font-semibold bg-teal-100 text-ink-900 px-3 py-1 rounded-full">
              {t('status_ready')}
            </span>
          )}
          {report.status === 'failed' && (
            <span className="text-[13px] font-semibold bg-red-100 text-red-600 px-3 py-1 rounded-full">
              {t('status_failed')}
            </span>
          )}

          {/* Summary button — always visible when done and not confirming delete */}
          {isDone && !confirming && (
            <button
              onClick={(e) => { e.stopPropagation(); unlockAudio(); navigate(`/report/${report.id}?autoSpeak=1`) }}
              className="text-[13px] font-semibold bg-accent-500 text-white hover:bg-accent-600 px-4 py-2 rounded-xl transition-colors shadow-sm"
            >
              {t('summary')}
            </button>
          )}

          {/* Generating indicator */}
          {isDone && !confirming && videoState === 'generating' && (
            <div className="flex items-center gap-1.5 px-1">
              <div className="w-3.5 h-3.5 border-2 border-ink-200 border-t-accent-500 rounded-full animate-spin shrink-0" />
              <span className="text-[12px] font-medium text-ink-400 animate-pulse whitespace-nowrap">Generating...</span>
            </div>
          )}

          {/* Play video button — only when ready */}
          {isDone && !confirming && videoState === 'ready' && (
            <button
              onClick={(e) => { e.stopPropagation(); onPlayVideo?.() }}
              className="flex items-center gap-1 text-[13px] font-semibold text-accent-500 hover:text-accent-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
                <path fillRule="evenodd" d="M2 10a8 8 0 1 1 16 0 8 8 0 0 1-16 0Zm6.39-2.908a.75.75 0 0 1 .766.027l3.5 2.25a.75.75 0 0 1 0 1.262l-3.5 2.25A.75.75 0 0 1 8 12.25v-4.5a.75.75 0 0 1 .39-.658Z" clipRule="evenodd" />
              </svg>
              Play video
            </button>
          )}

          {/* Delete confirm / trash icon */}
          {confirming ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-[13px] font-semibold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-xl disabled:opacity-50 transition-colors"
              >
                {deleting ? t('deleting') : t('delete')}
              </button>
              <button
                onClick={handleCancelDelete}
                className="text-[13px] font-medium text-ink-400 hover:text-ink-900 px-2 py-1.5 transition-colors"
              >
                {t('cancel')}
              </button>
            </div>
          ) : (
            <button
              onClick={handleDelete}
              aria-label={t('delete')}
              className="text-ink-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5Zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5Z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>

    </div>
  )
}
