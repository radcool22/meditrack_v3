import { createContext, useContext, useState } from 'react'
import i18n from '../utils/i18n.js'
import axios from 'axios'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    // Initialise from localStorage so language survives refresh
    return localStorage.getItem('mt_lang') || 'en'
  })

  function switchLanguage(lang) {
    setLanguage(lang)
    i18n.changeLanguage(lang)
    localStorage.setItem('mt_lang', lang)

    // Persist to DB so analysis generation uses the right language
    const token = localStorage.getItem('mt_token')
    if (token) {
      axios.patch(
        '/api/auth/profile',
        { language_preference: lang },
        { headers: { Authorization: `Bearer ${token}` } }
      ).catch(() => {
        // non-critical — fail silently
      })
    }
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
