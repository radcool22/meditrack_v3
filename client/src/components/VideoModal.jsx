import { useEffect } from 'react'

export default function VideoModal({ src, onClose }) {
  // Close on Escape key
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

        <video
          src={src}
          controls
          autoPlay
          playsInline
          style={{ width: '100%', maxWidth: '400px', aspectRatio: '9/16', borderRadius: '16px' }}
        />
      </div>
    </div>
  )
}
