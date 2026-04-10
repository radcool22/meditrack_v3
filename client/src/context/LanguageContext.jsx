import { createContext, useContext, useState } from 'react'
import i18n from '../utils/i18n.js'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en')

  function switchLanguage(lang) {
    setLanguage(lang)
    i18n.changeLanguage(lang)
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
