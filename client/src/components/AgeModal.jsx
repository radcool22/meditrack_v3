import { useState, useEffect } from 'react'

/**
 * Shown before video generation. Collects age for the render service safety gate.
 * Age is never stored — passed directly to onConfirm and discarded.
 *
 * Props:
 *   open        boolean — whether the modal is visible
 *   reportTitle string  — displayed as subtitle (can be null)
 *   onConfirm   (ageYears: number) => void — called with validated age
 *   onClose     () => void — called on cancel or backdrop click
 */
export default function AgeModal({ open, reportTitle, onConfirm, onClose }) {
  const [age, setAge] = useState('')
  const [error, setError] = useState('')

  // Reset state each time the modal opens
  useEffect(() => {
    if (open) {
      setAge('')
      setError('')
    }
  }, [open])

  if (!open) return null

  function handleSubmit() {
    const parsed = parseInt(age, 10)
    if (!age || isNaN(parsed) || parsed < 1) {
      setError('Please enter your age.')
      return
    }
    if (parsed < 18) {
      setError('This video feature is currently for adults only.')
      return
    }
    onConfirm(parsed)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSubmit()
    if (e.key === 'Escape') onClose()
  }

  const isValid = parseInt(age, 10) >= 18

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-5"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl p-6 shadow-xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#EEF4FF' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#3478F7" className="w-5 h-5">
            <path d="M3.25 4A2.25 2.25 0 001 6.25v7.5A2.25 2.25 0 003.25 16h7.5A2.25 2.25 0 0013 13.75v-7.5A2.25 2.25 0 0010.75 4h-7.5zM19 4.75a.75.75 0 00-1.28-.53l-3 3a.75.75 0 00-.22.53v4.5c0 .199.079.39.22.53l3 3a.75.75 0 001.28-.53V4.75z" />
          </svg>
        </div>

        <h2 className="text-[17px] font-bold text-ink-900 leading-snug">
          Generate a 60-second Hindi video summary
        </h2>
        {reportTitle && (
          <p className="text-[13px] text-ink-400 mt-1 leading-relaxed truncate">{reportTitle}</p>
        )}

        {/* Age input */}
        <label className="block mt-5">
          <span className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide">
            Your age (years)
          </span>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="120"
            value={age}
            onChange={(e) => { setAge(e.target.value); setError('') }}
            onKeyDown={handleKeyDown}
            placeholder="e.g. 35"
            autoFocus
            className="mt-1.5 w-full border-2 border-ink-200 focus:border-accent-500 rounded-xl px-4 py-3 text-[16px] font-medium text-ink-900 outline-none bg-white transition-colors placeholder-ink-400"
          />
        </label>

        {/* Validation error */}
        {error && (
          <p className="mt-2 text-[13px] font-medium text-red-500">{error}</p>
        )}

        {/* Buttons */}
        <div className="mt-5 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className="flex-1 bg-accent-500 hover:bg-accent-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-[15px] py-3 rounded-xl transition-colors shadow-sm"
          >
            Generate
          </button>
          <button
            onClick={onClose}
            className="flex-1 border-2 border-ink-200 text-ink-600 font-semibold text-[15px] py-3 rounded-xl hover:bg-surface transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
