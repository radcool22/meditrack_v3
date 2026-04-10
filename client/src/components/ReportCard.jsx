import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const STATUS_STYLES = {
  pending:    'bg-[#f5f5f5] text-[#8e8e8e]',
  processing: 'bg-yellow-50 text-yellow-700',
  done:       'bg-[#bbf451]/20 text-[#181818]',
  failed:     'bg-red-50 text-red-600',
}

const STATUS_LABELS = {
  pending:    'Pending',
  processing: 'Processing',
  done:       'Ready',
  failed:     'Failed',
}

export default function ReportCard({ report, onDelete }) {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const date = new Date(report.uploaded_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

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
          <p className="text-xs text-[#8e8e8e] mt-0.5">{date}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-xs font-medium rounded px-2 py-0.5 ${STATUS_STYLES[report.status] ?? STATUS_STYLES.pending}`}>
          {STATUS_LABELS[report.status] ?? report.status}
        </span>

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
