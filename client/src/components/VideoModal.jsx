import { useEffect, useState } from 'react'

export default function VideoModal({ src, onClose }) {
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.88)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[400px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button — positioned above the video */}
        <button
          onClick={onClose}
          className="absolute -top-11 right-0 flex items-center gap-1.5 text-white/70 hover:text-white text-[14px] font-semibold transition-colors"
        >
          <span>Close</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>

        {loadFailed ? (
          <div
            className="flex flex-col items-center justify-center gap-4 text-center px-6 py-10 rounded-2xl"
            style={{ background: '#0a0e1a', aspectRatio: '9/16', width: '100%', maxWidth: '400px' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)" className="w-12 h-12">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
            </svg>
            <p className="text-[15px] font-semibold text-white/70 leading-snug">
              Video unavailable — please regenerate
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2.5 rounded-xl text-[14px] font-semibold text-white bg-accent-500 hover:bg-accent-600 transition-colors"
            >
              Generate Video
            </button>
          </div>
        ) : (
          <video
            src={src}
            controls
            autoPlay
            playsInline
            onError={() => setLoadFailed(true)}
            style={{ width: '100%', maxWidth: '400px', aspectRatio: '9/16', borderRadius: '16px' }}
          />
        )}
      </div>
    </div>
  )
}
