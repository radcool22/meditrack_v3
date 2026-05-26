import { useState } from 'react'

// If src is provided, renders a real 9:16 video element.
// If src is null/undefined, renders the mock placeholder UI.
export default function VideoPlayer({ src }) {
  const [toast, setToast] = useState(false)

  if (src) {
    return (
      <div className="w-full max-w-[360px] mx-auto relative" style={{ aspectRatio: '9 / 16' }}>
        <video
          src={src}
          controls
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full rounded-2xl object-contain bg-black"
        />
      </div>
    )
  }

  function handlePlay() {
    if (toast) return
    setToast(true)
    setTimeout(() => setToast(false), 3000)
  }

  return (
    // Outer wrapper: sets aspect ratio + is the stacking context for the toast
    <div className="w-full max-w-[360px] mx-auto relative" style={{ aspectRatio: '9 / 16' }}>

      {/* ── Player chrome (overflow-hidden keeps rounded corners) ── */}
      <div
        className="absolute inset-0 rounded-2xl overflow-hidden flex flex-col"
        style={{ background: '#0a0e1a' }}
      >
        {/* Top labels */}
        <div className="flex items-center justify-between px-4 pt-4 shrink-0">
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-none">
            Hindi Video Summary
          </span>
          <span className="text-[11px] font-extrabold tracking-tight" style={{ color: 'rgba(255,255,255,0.08)' }}>
            MediTrack
          </span>
        </div>

        {/* Centre — play button */}
        <button
          onClick={handlePlay}
          className="flex-1 flex items-center justify-center focus:outline-none"
          aria-label="Play video"
        >
          <div
            className="w-[72px] h-[72px] rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
          >
            {/* Play triangle — offset right so it looks centred in the circle */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0a0e1a" className="w-8 h-8 ml-1">
              <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
            </svg>
          </div>
        </button>

        {/* Bottom controls */}
        <div className="shrink-0">
          {/* Thin progress bar */}
          <div className="w-full h-[2px]" style={{ background: 'rgba(255,255,255,0.15)' }} />
          {/* Timestamp + fullscreen row */}
          <div className="flex items-center justify-between px-4 py-3">
            <span
              className="text-[12px] text-white/40 font-mono"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              0:00 / 1:00
            </span>
            <button
              onClick={handlePlay}
              className="text-white/40 hover:text-white/70 transition-colors focus:outline-none"
              aria-label="Fullscreen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="w-4 h-4">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Toast — sibling of overflow-hidden div so it isn't clipped ── */}
      {toast && (
        <div
          className="absolute bottom-14 left-1/2 -translate-x-1/2 z-10 px-4 py-2.5 rounded-xl text-[12px] font-semibold text-white text-center pointer-events-none"
          style={{
            background: 'rgba(10,14,26,0.88)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.12)',
            maxWidth: '88%',
            whiteSpace: 'nowrap',
          }}
        >
          Video generation coming soon — please check back shortly
        </div>
      )}
    </div>
  )
}
