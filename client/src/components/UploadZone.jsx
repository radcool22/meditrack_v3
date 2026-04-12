import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png']
const LABELS  = { 'application/pdf': 'PDF', 'image/jpeg': 'JPG', 'image/png': 'PNG' }
const BADGE   = 'text-[12px] font-bold bg-amber-100 text-accent-500 rounded-lg px-2.5 py-1 shrink-0 uppercase tracking-wide'

export default function UploadZone({ onUpload }) {
  const { t } = useTranslation()
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [pendingFiles, setPendingFiles] = useState([]) // [{ id, file, progress, error }]
  const [errors, setErrors] = useState([])

  function validate(file) {
    if (!ALLOWED.includes(file.type)) return `"${file.name}": ${t('only_pdf_jpg_png')}`
    if (file.size > 20 * 1024 * 1024) return `"${file.name}": ${t('file_too_large')}`
    return null
  }

  function addFiles(fileList) {
    const errs = []
    const valid = []
    for (const file of fileList) {
      const err = validate(file)
      if (err) { errs.push(err); continue }
      valid.push({ id: `${file.name}-${Date.now()}-${Math.random()}`, file, progress: 0, error: null })
    }
    setErrors(errs)
    if (valid.length) setPendingFiles(prev => [...prev, ...valid])
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  function removeFile(id) {
    setPendingFiles(prev => prev.filter(f => f.id !== id))
  }

  const isUploading = pendingFiles.some(f => f.progress > 0)

  async function handleUploadAll() {
    setErrors([])
    await Promise.all(
      pendingFiles
        .filter(pf => pf.progress === 0 && !pf.error)
        .map(async (pf) => {
          try {
            await onUpload(pf.file, (p) =>
              setPendingFiles(prev => prev.map(f => f.id === pf.id ? { ...f, progress: p } : f))
            )
            setPendingFiles(prev => prev.filter(f => f.id !== pf.id))
          } catch (err) {
            const msg = err.response?.data?.error || t('upload_failed')
            setPendingFiles(prev => prev.map(f => f.id === pf.id ? { ...f, error: msg, progress: 0 } : f))
          }
        })
    )
  }

  return (
    <div className="w-full space-y-3">
      {/* Drop zone — always visible so user can keep adding files */}
      <div
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-2xl py-6 px-8 text-center cursor-pointer transition-all duration-200
          ${dragging
            ? 'border-teal-500 bg-teal-50 scale-[1.01]'
            : 'border-teal-200 bg-teal-50/50 hover:border-teal-500 hover:bg-teal-50'
          }`}
      >
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
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files.length) addFiles(Array.from(e.target.files)); e.target.value = '' }}
        />
      </div>

      {/* Validation errors */}
      {errors.map((e, i) => (
        <p key={i} className="text-[13px] font-medium text-red-500">{e}</p>
      ))}

      {/* Pending file list */}
      {pendingFiles.length > 0 && (
        <div className="border border-ink-200/60 rounded-2xl bg-card shadow-sm overflow-hidden">
          <div className="divide-y divide-ink-200/60">
            {pendingFiles.map((pf) => (
              <div key={pf.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={BADGE}>{LABELS[pf.file.type]}</span>
                    <span className="text-[14px] font-medium text-ink-900 truncate">{pf.file.name}</span>
                  </div>
                  {pf.progress === 0 && !pf.error && (
                    <button
                      onClick={() => removeFile(pf.id)}
                      className="text-ink-400 hover:text-ink-900 text-[13px] font-medium shrink-0 transition-colors"
                    >
                      {t('remove')}
                    </button>
                  )}
                  {pf.progress > 0 && (
                    <span className="text-[13px] font-medium text-accent-500 shrink-0">{pf.progress}%</span>
                  )}
                  {pf.error && (
                    <span className="text-[13px] font-medium text-red-500 shrink-0">{t('status_failed')}</span>
                  )}
                </div>

                {pf.progress > 0 && (
                  <div className="h-1 bg-ink-200 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-1 bg-gradient-to-r from-accent-600 to-accent-500 rounded-full transition-all duration-150"
                      style={{ width: `${pf.progress}%` }}
                    />
                  </div>
                )}

                {pf.error && (
                  <p className="text-[12px] text-red-500 mt-1">{pf.error}</p>
                )}
              </div>
            ))}
          </div>

          <div className="px-5 py-4 border-t border-ink-200/60">
            <button
              onClick={handleUploadAll}
              disabled={isUploading}
              className="w-full bg-accent-500 hover:bg-accent-600 disabled:opacity-40 text-white text-[15px] font-semibold py-3.5 rounded-xl transition-all duration-150 shadow-md hover:shadow-lg"
            >
              {isUploading
                ? t('uploading_progress', { progress: '' }).trim()
                : pendingFiles.length === 1
                  ? t('upload_btn')
                  : `Upload ${pendingFiles.filter(f => f.progress === 0 && !f.error).length} files`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
