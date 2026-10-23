import { useState } from 'react'

const AGE_KEY = 'mt_video_age'

function rememberedAge() {
  try { return localStorage.getItem(AGE_KEY) ?? '' } catch { return '' }
}

// Asks the patient's age before a video is made — the render service's
// pediatric safety gate depends on it (reports for under-18s get no video).
export default function VideoAgeModal({ reportTitle, onConfirm, onClose }) {
  const [age, setAge] = useState(rememberedAge)
  const value = parseInt(age, 10)
  const valid = Number.isInteger(value) && value >= 1 && value <= 120

  function handleSubmit(e) {
    e.preventDefault()
    if (!valid) return
    try { localStorage.setItem(AGE_KEY, String(value)) } catch {}
    onConfirm(value)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm shadow-xl p-6"
      >
        <h2 className="text-[17px] font-bold text-ink-900 mb-1">Patient's age</h2>
        <p className="text-[13px] text-ink-400 mb-4">
          {reportTitle ? <>For <span className="font-semibold text-ink-600">{reportTitle}</span>. </> : null}
          We use it to make sure the video is right for the patient.
        </p>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={120}
          value={age}
          onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 3))}
          placeholder="Age in years"
          autoFocus
          className="w-full border-2 border-ink-200 focus:border-accent-500 rounded-xl px-4 py-3.5 text-[17px] font-medium text-ink-900 placeholder-ink-400 outline-none transition-colors bg-white"
        />
        <button
          type="submit"
          disabled={!valid}
          className="mt-4 w-full bg-accent-500 hover:bg-accent-600 disabled:opacity-40 text-white text-[15px] font-semibold py-3.5 rounded-xl transition-colors shadow-sm"
        >
          Generate Video
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full text-center text-[14px] font-semibold text-ink-400 hover:text-ink-900 py-2 transition-colors"
        >
          Cancel
        </button>
      </form>
    </div>
  )
}
