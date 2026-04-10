import { useRef, useState } from 'react'

const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png']
const LABELS = { 'application/pdf': 'PDF', 'image/jpeg': 'JPG', 'image/png': 'PNG' }

export default function UploadZone({ onUpload }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [pending, setPending] = useState(null)   // { file, progress }
  const [error, setError] = useState('')

  function validate(file) {
    if (!ALLOWED.includes(file.type)) {
      setError('Only PDF, JPG, and PNG files are allowed')
      return false
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('File must be under 20 MB')
      return false
    }
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
      setError(err.response?.data?.error || 'Upload failed')
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
          className={`border-2 border-dashed rounded-xl px-6 py-10 text-center cursor-pointer transition-colors
            ${dragging ? 'border-[#181818] bg-[#f5f5f5]' : 'border-[#e0e0e0] hover:border-[#181818]'}`}
        >
          <p className="text-sm font-medium text-[#181818]">
            Drop your report here, or <span className="underline underline-offset-2">browse</span>
          </p>
          <p className="text-xs text-[#8e8e8e] mt-1">PDF, JPG, PNG — max 20 MB</p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => { if (e.target.files[0]) pickFile(e.target.files[0]) }}
          />
        </div>
      ) : (
        <div className="border border-[#e0e0e0] rounded-xl px-6 py-5 bg-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs font-medium bg-[#181818] text-white rounded px-2 py-0.5 shrink-0">
                {LABELS[pending.file.type]}
              </span>
              <span className="text-sm text-[#181818] truncate">{pending.file.name}</span>
            </div>
            <button
              onClick={() => { setPending(null); setError('') }}
              className="text-[#8e8e8e] hover:text-[#181818] text-xs ml-3 shrink-0"
            >
              Remove
            </button>
          </div>

          {/* Progress bar */}
          {pending.progress > 0 && (
            <div className="h-1 bg-[#e0e0e0] rounded-full mb-3">
              <div
                className="h-1 bg-[#bbf451] rounded-full transition-all duration-150"
                style={{ width: `${pending.progress}%` }}
              />
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={pending.progress > 0}
            className="w-full bg-[#181818] hover:bg-[#bbf451] hover:text-[#181818] disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            {pending.progress > 0 ? `Uploading ${pending.progress}%…` : 'Upload Report'}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  )
}
