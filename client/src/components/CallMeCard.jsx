import { forwardRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { getLanguage } from '../config/languages'
import { useCall } from '../hooks/useCall'
import { callOutcomeMessage, formatPhone, formatDuration } from '../utils/callApi'

const LIME = 'rgb(199, 243, 108)'

function PhoneIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

// One-time agreement before MediTrack first rings the user.
function ConsentSheet({ phone, onAgree, onCancel, busy }) {
  // Escape closes the sheet, like tapping outside it.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const points = [
    <>MediTrack will call <b className="text-ink-900">{phone}</b>, the number on your account.</>,
    <>Your results are spoken out loud, so take the call somewhere private.</>,
    <>You'll talk to an AI assistant, not a doctor. In an emergency, call <b className="text-ink-900">112</b>.</>,
    <>The call is transcribed so we can save a short summary for you.</>,
  ]
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="call-consent-title"
        className="bg-card rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4 text-ink-900" style={{ background: LIME }}>
          <PhoneIcon />
        </div>
        <h2 id="call-consent-title" className="text-[17px] font-bold text-ink-900 mb-3">Before we call you</h2>
        <ul className="space-y-2.5 mb-5">
          {points.map((p, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] text-ink-600 leading-snug">
              <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-ink-900 shrink-0" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <button
          onClick={onAgree}
          disabled={busy}
          className="w-full bg-ink-900 hover:bg-black disabled:opacity-50 text-white text-[15px] font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <PhoneIcon className="w-4 h-4" />
          {busy ? 'Calling…' : 'Agree and call me'}
        </button>
        <button
          onClick={onCancel}
          className="mt-2 w-full text-center text-[14px] font-semibold text-ink-400 hover:text-ink-900 py-2 transition-colors"
        >
          Not now
        </button>
        <p className="text-center text-[12px] text-ink-400 mt-1">
          See our{' '}
          <a href="https://www.meditrack.in/terms-of-use#calls" target="_blank" rel="noopener noreferrer" className="underline hover:text-ink-900">
            Terms of Use
          </a>
        </p>
      </div>
    </div>
  )
}

/**
 * "Call me": MediTrack rings the user and talks them through their reports.
 * variant "hero" is the dashboard's dark feature card; "compact" sits on a
 * report page and calls about that report.
 */
const CallMeCard = forwardRef(function CallMeCard({ variant = 'hero', reportId = null, disabled = false, highlight = false }, ref) {
  const { user } = useAuth()
  const { language } = useLanguage()
  const { phase, call, error, from, start, confirmConsent, cancelConsent, reset } = useCall(reportId)

  const hero = variant === 'hero'
  const phone = formatPhone(user?.phone_number)
  const langName = getLanguage(language).nativeName
  const busy = phase === 'starting'

  const title = hero ? 'Talk to MediTrack on the phone' : 'Talk about this report on the phone'
  const text = {
    title:  hero ? 'text-white' : 'text-ink-900',
    body:   hero ? 'text-white/70' : 'text-ink-400',
    strong: hero ? 'text-white' : 'text-ink-900',
  }

  const callButton = (label) => (
    <button
      onClick={start}
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-[15px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
        hero ? 'text-ink-900 hover:brightness-95 w-full sm:w-auto' : 'bg-ink-900 hover:bg-black text-white w-full sm:w-auto'
      }`}
      style={hero ? { background: LIME } : undefined}
    >
      <PhoneIcon className="w-4 h-4" />
      {busy ? 'Starting the call…' : label}
    </button>
  )

  let content
  if (phase === 'calling') {
    content = (
      <div className="flex items-center gap-4" role="status" aria-live="polite">
        <span className="relative flex w-12 h-12 shrink-0">
          <span className="absolute inset-0 rounded-full animate-ping opacity-60" style={{ background: LIME }} />
          <span className="relative w-12 h-12 rounded-full flex items-center justify-center text-ink-900" style={{ background: LIME }}>
            <PhoneIcon />
          </span>
        </span>
        <div className="min-w-0">
          <p className={`text-[17px] font-bold ${text.title}`}>Calling {phone}…</p>
          <p className={`text-[14px] mt-0.5 leading-snug ${text.body}`}>
            Pick up the call{from ? <> from <span className={`font-semibold ${text.strong}`}>{formatPhone(from)}</span></> : null}. This updates when you hang up.
          </p>
        </div>
      </div>
    )
  } else if (phase === 'ended' && call) {
    const done = call.status === 'completed'
    content = (
      <div role="status" aria-live="polite">
        <p className={`text-[17px] font-bold ${text.title}`}>
          {done ? 'Call finished' : 'The call didn’t connect'}
          {done && call.duration_sec ? <span className={`font-medium ${text.body}`}> · {formatDuration(call.duration_sec)}</span> : null}
        </p>
        {call.urgent && (
          <div className="mt-3 rounded-xl px-4 py-3 bg-red-50 border border-red-200 text-[14px] font-medium text-red-700 leading-snug">
            You mentioned symptoms that need a doctor soon. If it feels like an emergency, call 112 now.
          </div>
        )}
        {done ? (
          call.summary ? (
            <p className={`mt-2 text-[15px] leading-relaxed ${hero ? 'text-white/85' : 'text-ink-600'}`}>{call.summary}</p>
          ) : (
            <p className={`mt-2 text-[14px] ${text.body}`}>Your summary is being written — it will appear under Your calls.</p>
          )
        ) : (
          <p className={`mt-1 text-[14px] leading-snug ${text.body}`}>{callOutcomeMessage(call)}</p>
        )}
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          {callButton(done ? 'Call me again' : 'Try again')}
          <button
            onClick={reset}
            className={`rounded-xl px-5 py-3 text-[14px] font-semibold transition-colors ${hero ? 'text-white/70 hover:text-white' : 'text-ink-400 hover:text-ink-900'}`}
          >
            Done
          </button>
        </div>
      </div>
    )
  } else {
    content = hero ? (
      <>
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest" style={{ color: LIME }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: LIME }} />
          Phone call
        </p>
        <h2 className="mt-2 text-[22px] sm:text-[24px] font-bold text-white leading-tight tracking-tight">{title}</h2>
        <p className="mt-2 text-[15px] text-white/70 leading-relaxed">
          {disabled
            ? 'Upload a report first — then MediTrack can call you and talk you through it.'
            : <>We'll call <span className="font-semibold text-white">{phone}</span> and talk you through your reports in <span className="font-semibold text-white">{langName}</span>. Ask anything, interrupt any time.</>}
        </p>
        <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
          {callButton('Call me now')}
          <span className="text-[13px] text-white/50">Rings in a few seconds · 8 am – 9:30 pm</span>
        </div>
      </>
    ) : (
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-ink-900" style={{ background: LIME }}>
            <PhoneIcon />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-ink-900">{title}</p>
            <p className="text-[13px] text-ink-400 mt-0.5">MediTrack calls {phone} and explains it in {langName}.</p>
          </div>
        </div>
        {callButton('Call me')}
      </div>
    )
  }

  return (
    <section
      ref={ref}
      id={hero ? 'call-me' : undefined}
      aria-label={title}
      className={`rounded-2xl transition-shadow ${
        hero ? 'px-5 py-6 sm:px-7 sm:py-7 shadow-lg' : 'bg-card border border-ink-200/60 px-5 py-4 shadow-sm'
      } ${highlight ? 'ring-4 ring-offset-2' : ''}`}
      style={{
        ...(hero ? { background: 'radial-gradient(120% 140% at 100% 0%, rgba(199,243,108,0.16) 0%, transparent 55%), #0f1411' } : {}),
        ...(highlight ? { '--tw-ring-color': LIME } : {}),
      }}
    >
      {content}
      {error && (
        <p role="alert" className={`mt-3 text-[14px] font-medium leading-snug ${hero ? 'text-red-300' : 'text-red-600'}`}>{error}</p>
      )}
      {phase === 'consent' && (
        <ConsentSheet phone={phone} onAgree={confirmConsent} onCancel={cancelConsent} busy={busy} />
      )}
    </section>
  )
})

export default CallMeCard
