import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png']
const LABELS = { 'application/pdf': 'PDF', 'image/jpeg': 'JPG', 'image/png': 'PNG' }

export default function UploadZone({ onUpload }) {
  const { t } = useTranslation()
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [pending, setPending] = useState(null)
  const [error, setError] = useState('')

  function validate(file) {
    if (!ALLOWED.includes(file.type)) { setError(t('only_pdf_jpg_png')); return false }
    if (file.size > 20 * 1024 * 1024) { setError(t('file_too_large')); return false }
    return true
  }

  function pickFile(file) {
    setError('')
    if (!validate(file)) return
    setPending({ file, progress: 0 })
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) pickFile(file)
  }

  async function handleUpload() {
    if (!pending) return
    try {
      await onUpload(pending.file, (p) => setPending((prev) => ({ ...prev, progress: p })))
      setPending(null)
    } catch (err) {
      setError(err.response?.data?.error || t('upload_failed'))
      setPending(null)
    }
  }

  return (
    <div className="w-full">
      {!pending ? (
        <div
          onClick={() => inputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-2xl py-12 px-8 text-center cursor-pointer transition-all duration-200
            ${dragging
              ? 'border-teal-500 bg-teal-50 scale-[1.01]'
              : 'border-teal-200 bg-teal-50/50 hover:border-teal-500 hover:bg-teal-50'
            }`}
        >
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-teal-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="rgb(199, 243, 108)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
                <polyline points="16 16 12 12 8 16" />
                <line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
              </svg>
            </div>
          </div>

          <p className="text-[16px] font-bold text-ink-900 mb-1">{t('drop_report')}</p>
          <p className="text-[15px] text-ink-400 font-medium mb-4">
            {t('or')}{' '}
            <span className="text-accent-500 font-semibold underline underline-offset-2">
              {t('browse_files')}
            </span>
          </p>

          <div className="flex items-center justify-center gap-2">
            <span className="text-[12px] font-semibold bg-amber-100 text-accent-500 px-3 py-1 rounded-full">PDF</span>
            <span className="text-[12px] font-semibold bg-amber-100 text-amber-500 px-3 py-1 rounded-full">JPG</span>
            <span className="text-[12px] font-semibold bg-orange-100 text-coral-500 px-3 py-1 rounded-full">PNG</span>
            <span className="text-[12px] font-medium text-ink-400">{t('max_20mb')}</span>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => { if (e.target.files[0]) pickFile(e.target.files[0]) }}
          />
        </div>
      ) : (
        <div className="border border-ink-200/60 rounded-2xl px-6 py-5 bg-card shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-[12px] font-bold bg-amber-100 text-accent-500 rounded-lg px-2.5 py-1 shrink-0 uppercase tracking-wide">
                {LABELS[pending.file.type]}
              </span>
              <span className="text-[15px] font-medium text-ink-900 truncate">{pending.file.name}</span>
            </div>
            <button
              onClick={() => { setPending(null); setError('') }}
              className="text-ink-400 hover:text-ink-900 text-[13px] font-medium ml-3 shrink-0 transition-colors"
            >
              {t('remove')}
            </button>
          </div>

          {pending.progress > 0 && (
            <div className="h-1.5 bg-ink-200 rounded-full mb-4 overflow-hidden">
              <div
                className="h-1.5 bg-gradient-to-r from-accent-600 to-accent-500 rounded-full transition-all duration-150"
                style={{ width: `${pending.progress}%` }}
              />
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={pending.progress > 0}
            className="w-full bg-accent-500 hover:bg-accent-600 disabled:opacity-40 text-white text-[15px] font-semibold py-4 rounded-xl transition-all duration-150 shadow-md hover:shadow-lg"
          >
            {pending.progress > 0
              ? t('uploading_progress', { progress: pending.progress })
              : t('upload_btn')}
          </button>
        </div>
      )}

      {error && <p className="text-[13px] font-medium text-red-500 mt-2">{error}</p>}
    </div>
  )
}
