import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function formatReportDate(report) {
  const src = report.report_date ?? report.uploaded_at
  return new Date(src).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function ReportCard({ report, onDelete }) {
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

  return (
    <div
      onClick={() => !confirming && navigate(`/report/${report.id}`)}
      className="bg-white border border-[#e0e0e0] rounded-xl p-5 flex items-start justify-between gap-4 hover:border-[#181818] transition-colors cursor-pointer"
    >
      <div className="flex items-start gap-3 min-w-0">
        <span className="text-xs font-medium bg-[#181818] text-white rounded px-2 py-0.5 mt-0.5 shrink-0 uppercase">
          {report.file_type}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#181818] truncate">{report.file_name}</p>
          <p className="text-xs text-[#8e8e8e] mt-0.5">{dateLabel}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Status indicator — spinner while processing, green badge when done */}
        {isProcessing && (
          <div className="w-4 h-4 border-2 border-[#e0e0e0] border-t-[#181818] rounded-full animate-spin" />
        )}
        {isDone && (
          <span className="text-xs font-medium bg-[#bbf451]/20 text-[#181818] rounded px-2 py-0.5">
            Ready
          </span>
        )}
        {report.status === 'failed' && (
          <span className="text-xs font-medium bg-red-50 text-red-600 rounded px-2 py-0.5">
            Failed
          </span>
        )}

        {/* Report Summary button — only when done */}
        {isDone && !confirming && (
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/report/${report.id}?autoSpeak=1`) }}
            className="text-xs font-medium text-[#181818] border border-[#e0e0e0] rounded px-2 py-1 hover:bg-[#f5f5f5] transition-colors"
          >
            Summary
          </button>
        )}

        {confirming ? (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs font-medium text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded disabled:opacity-50"
            >
              {deleting ? '…' : 'Delete'}
            </button>
            <button
              onClick={handleCancelDelete}
              className="text-xs font-medium text-[#8e8e8e] hover:text-[#181818] px-2 py-1"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={handleDelete}
            aria-label="Delete report"
            className="text-[#8e8e8e] hover:text-red-500 transition-colors p-1 rounded"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
