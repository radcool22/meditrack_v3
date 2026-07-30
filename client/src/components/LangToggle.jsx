import { useLanguage } from '../context/LanguageContext'
import { getAllLanguages, isSupported } from '../config/languages'

/**
 * Compact language dropdown — all 5 supported languages, shown by nativeName.
 * Replaces the old binary EN/HI pill toggle.
 */
export default function LangToggle({ dark = false }) {
  const { language, switchLanguage } = useLanguage()
  const selected = isSupported(language) ? language : 'en'

  return (
    <select
      value={selected}
      onChange={(e) => switchLanguage(e.target.value)}
      aria-label="Select language"
      className={`text-[13px] font-semibold rounded-lg border px-2.5 py-1.5 outline-none transition-colors cursor-pointer ${
        dark
          ? 'bg-white/10 text-white border-white/20 focus:border-white/40'
          : 'bg-white text-ink-900 border-ink-200 focus:border-accent-500'
      }`}
    >
      {getAllLanguages().map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.nativeName}
        </option>
      ))}
    </select>
  )
}
