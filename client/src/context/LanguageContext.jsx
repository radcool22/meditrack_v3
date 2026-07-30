import { createContext, useContext, useState } from 'react'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  // Website language source of truth: localStorage['mt_lang'] only, set
  // exclusively via switchLanguage(). Defaults to 'en' for a fresh user.
  // Deliberately does NOT fall back to users.language_preference — that
  // fallback (removed) caused a real bug: a stale cached AuthContext.user
  // snapshot (frozen at whatever it was at last login) kept overwriting the
  // user's explicit toggle choice with an old WhatsApp-set value ('gu').
  const [language, setLanguageState] = useState(() => localStorage.getItem('mt_lang') ?? 'en')

  function switchLanguage(lang) {
    setLanguageState(lang)
    localStorage.setItem('mt_lang', lang)
    // UI always stays in English — this only controls voice/chat response language
  }

  return (
    <LanguageContext.Provider value={{ language: language ?? 'en', switchLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
