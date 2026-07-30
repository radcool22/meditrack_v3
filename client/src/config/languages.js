// Single source of truth for every language MediTrack supports.
// Both server/config/languages.js and client/src/config/languages.js must
// stay byte-for-byte identical in their data (helpers may differ only if
// the runtime genuinely requires it — currently they don't).

const LANGUAGES = {
  en: {
    code: 'en',
    nativeName: 'English',
    elevenLabsModel: 'eleven_flash_v2_5',
    elevenLabsVoiceId: 'PpXxSapWoo4j3JoF2LPQ',
    ttsLanguageCode: 'en',
    browserSttLocale: 'en-IN',
    script: 'Latin',
    scriptRegex: /[A-Za-z]/,
    // Matches the pre-registry hardcoded chatController.js override verbatim —
    // chatController wraps this with the "explicitly chosen English" lead-in itself.
    promptInstruction: 'You MUST respond in English.',
  },
  hi: {
    code: 'hi',
    nativeName: 'हिंदी',
    elevenLabsModel: 'eleven_flash_v2_5',
    elevenLabsVoiceId: 'mActWQg9kibLro6Z2ouY',
    ttsLanguageCode: 'hi',
    browserSttLocale: 'hi-IN',
    script: 'Devanagari',
    scriptRegex: /[ऀ-ॿ]/,
    // Matches the pre-registry hardcoded chatController.js override verbatim —
    // chatController wraps this with the "explicitly chosen Hindi" lead-in itself.
    promptInstruction:
      'You MUST respond in Hindi using Devanagari script (हिंदी). Do NOT use Roman/English-alphabet Hindi. This overrides the auto-detect rule above.',
  },
  mr: {
    code: 'mr',
    nativeName: 'मराठी',
    elevenLabsModel: 'eleven_v3',
    // Placeholder — reuses the Hindi voice pending a Marathi-specific ElevenLabs voice ID.
    // eleven_v3's language_code param still drives correct pronunciation with this voice.
    elevenLabsVoiceId: 'mActWQg9kibLro6Z2ouY',
    ttsLanguageCode: 'mr',
    browserSttLocale: 'mr-IN',
    script: 'Devanagari',
    scriptRegex: /[ऀ-ॿ]/,
    promptInstruction:
      'You MUST respond ONLY in Marathi using Devanagari script (मराठी). Do NOT use any other language or script. This overrides any auto-detect rule.',
  },
  gu: {
    code: 'gu',
    nativeName: 'ગુજરાતી',
    elevenLabsModel: 'eleven_v3',
    // Placeholder — reuses the Hindi voice pending a Gujarati-specific ElevenLabs voice ID.
    elevenLabsVoiceId: 'mActWQg9kibLro6Z2ouY',
    ttsLanguageCode: 'gu',
    browserSttLocale: 'gu-IN',
    script: 'Gujarati',
    scriptRegex: /[઀-૿]/,
    promptInstruction:
      'You MUST respond ONLY in Gujarati using Gujarati script (ગુજરાતી). Do NOT use any other language or script. This overrides any auto-detect rule.',
  },
  ml: {
    code: 'ml',
    nativeName: 'മലയാളം',
    elevenLabsModel: 'eleven_v3',
    // Placeholder — reuses the Hindi voice pending a Malayalam-specific ElevenLabs voice ID.
    elevenLabsVoiceId: 'mActWQg9kibLro6Z2ouY',
    ttsLanguageCode: 'ml',
    browserSttLocale: 'ml-IN',
    script: 'Malayalam',
    scriptRegex: /[ഀ-ൿ]/,
    promptInstruction:
      'You MUST respond ONLY in Malayalam using Malayalam script (മലയാളം). Do NOT use any other language or script. This overrides any auto-detect rule.',
  },
}

// Fixed order for anything that needs to render/iterate all languages (e.g. a language picker).
const LANGUAGE_ORDER = ['en', 'hi', 'mr', 'gu', 'ml']

/**
 * Returns the registry entry for `code`, or the English entry if `code` is
 * missing/unknown. Never falls back to Hindi — English is the only safe default.
 */
export function getLanguage(code) {
  return LANGUAGES[code] ?? LANGUAGES.en
}

/** Returns true if `code` is one of the five supported languages. */
export function isSupported(code) {
  return Object.prototype.hasOwnProperty.call(LANGUAGES, code)
}

/** Returns all registry entries in display order. */
export function getAllLanguages() {
  return LANGUAGE_ORDER.map((code) => LANGUAGES[code])
}
