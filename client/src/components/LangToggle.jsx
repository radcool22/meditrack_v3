import { useLanguage } from '../context/LanguageContext'

/**
 * Compact Aa / अआ language toggle.
 * dark={true}  → styled for dark/teal navbars (login page)
 * dark={false} → styled for light navbars (dashboard, report page)
 */
export default function LangToggle({ dark = false }) {
  const { language, switchLanguage } = useLanguage()

  const track = dark ? 'bg-white/10' : 'bg-ink-200/30'

  const activeClass = 'text-white shadow-md'
  const activeStyle = { backgroundColor: '#FF6B4A' }
  const inactiveClass = dark
    ? 'text-white/50 hover:text-white/80'
    : 'text-ink-300 hover:text-ink-500'

  return (
    <div className={`flex rounded-xl p-1 gap-1 ${track}`}>
      <button
        onClick={() => switchLanguage('en')}
        style={language === 'en' ? activeStyle : undefined}
        className={`px-3 py-2 text-[13px] font-bold rounded-lg transition-all ${
          language === 'en' ? activeClass : inactiveClass
        }`}
      >
        Voice: EN
      </button>
      <button
        onClick={() => switchLanguage('hi')}
        style={language === 'hi' ? activeStyle : undefined}
        className={`px-3 py-2 text-[13px] font-bold rounded-lg transition-all ${
          language === 'hi' ? activeClass : inactiveClass
        }`}
      >
        Voice: HI
      </button>
    </div>
  )
}
