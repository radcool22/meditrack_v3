import { useLanguage } from '../context/LanguageContext'

/**
 * Neumorphic flag slider toggle — EN (🇬🇧) ↔ HI (🇮🇳)
 * Matches the pill-with-sliding-circle design from the reference image.
 */
export default function LangToggle({ dark = false }) {
  const { language, switchLanguage } = useLanguage()
  const isHindi = language === 'hi'

  const labelActive   = dark ? 'text-white font-extrabold' : 'text-ink-900 font-extrabold'
  const labelInactive = dark ? 'text-white/35 font-bold'   : 'text-ink-300 font-bold'

  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* EN label */}
      <span className={`text-[13px] tracking-widest uppercase transition-colors ${isHindi ? labelInactive : labelActive}`}>
        EN
      </span>

      {/* Pill track */}
      <button
        onClick={() => switchLanguage(isHindi ? 'en' : 'hi')}
        aria-label={isHindi ? 'Switch to English' : 'Switch to Hindi'}
        className="relative w-[58px] h-[30px] rounded-full focus:outline-none transition-all"
        style={{
          background: 'rgb(52,120,247)',
          boxShadow: dark
            ? 'inset 1px 1px 4px rgba(0,0,0,0.25)'
            : 'inset 1px 1px 4px rgba(0,0,0,0.2)',
        }}
      >
        {/* Sliding circle with flag */}
        <div
          className="absolute top-[3px] w-6 h-6 rounded-full flex items-center justify-center text-[14px] transition-all duration-300 ease-in-out"
          style={{
            left: isHindi ? '30px' : '3px',
            background: 'white',
            boxShadow: '0 2px 6px rgba(0,0,0,0.22), 0 1px 2px rgba(0,0,0,0.12)',
          }}
        >
          {isHindi ? '🇮🇳' : '🇬🇧'}
        </div>
      </button>

      {/* HI label */}
      <span className={`text-[13px] tracking-widest uppercase transition-colors ${isHindi ? labelActive : labelInactive}`}>
        HI
      </span>
    </div>
  )
}
