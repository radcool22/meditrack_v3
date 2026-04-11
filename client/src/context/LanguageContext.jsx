import { createContext, useContext, useState } from 'react'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    // Persists voice language preference across refresh
    return localStorage.getItem('mt_lang') || 'en'
  })

  function switchLanguage(lang) {
    setLanguage(lang)
    localStorage.setItem('mt_lang', lang)
    // UI always stays in English — this only controls voice/chat response language
  }

  return (
    <LanguageContext.Provider value={{ language, switchLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
