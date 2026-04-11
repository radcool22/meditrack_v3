import { useLanguage } from '../context/LanguageContext'

/**
 * Compact Aa / अआ language toggle.
 * dark={true}  → styled for dark/teal navbars (login page)
 * dark={false} → styled for light navbars (dashboard, report page)
 */
export default function LangToggle({ dark = false }) {
  const { language, switchLanguage } = useLanguage()

  const track = dark ? 'bg-white/10' : 'bg-ink-200/40'
  const active = dark ? 'bg-white text-teal-800' : 'bg-white text-teal-700 shadow-sm'
  const inactive = dark ? 'text-white/70 hover:text-white' : 'text-ink-400 hover:text-ink-900'

  return (
    <div className={`flex rounded-xl p-0.5 ${track}`}>
      <button
        onClick={() => switchLanguage('en')}
        className={`px-3 py-1.5 text-[13px] font-bold rounded-lg transition-all ${
          language === 'en' ? active : inactive
        }`}
      >
        Aa
      </button>
      <button
        onClick={() => switchLanguage('hi')}
        className={`px-3 py-1.5 text-[13px] font-bold rounded-lg transition-all ${
          language === 'hi' ? active : inactive
        }`}
      >
        अआ
      </button>
    </div>
  )
}
