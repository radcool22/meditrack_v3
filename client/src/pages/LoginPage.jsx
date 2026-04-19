import { useState, useRef } from 'react'
import logo from '../assets/logo.svg'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'

const INDIA_RE = /^[6-9]\d{9}$/
const USA_RE   = /^\d{10}$/
const DEV_TEST_PHONE = '0000000000'

const COUNTRY_CODES = [
  { code: '+91', label: '+91', maxLen: 10, validate: (p) => INDIA_RE.test(p) },
  { code: '+1',  label: '+1',  maxLen: 10, validate: (p) => USA_RE.test(p) },
]

export default function LoginPage() {
  const { t } = useTranslation()
  const { login, updateUser, token } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [countryCode, setCountryCode] = useState('+91')
  const countryCodeRef = useRef('+91')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('phone') // 'phone' | 'otp'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [showNameModal, setShowNameModal] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [nameLoading, setNameLoading] = useState(false)
  const [nameError, setNameError] = useState('')
  const [savedToken, setSavedToken] = useState(null)

  const selectedCountry = COUNTRY_CODES.find(c => c.code === countryCode) ?? COUNTRY_CODES[0]

  function isValidPhone(p) {
    if (p === DEV_TEST_PHONE) return true
    return selectedCountry.validate(p)
  }

  async function handleSendOtp(e) {
    e.preventDefault()
    setError('')
    if (!isValidPhone(phone)) {
      setError(t('invalid_phone'))
      return
    }
    setLoading(true)
    try {
      await axios.post('/api/auth/send-otp', { phone_number: `${countryCodeRef.current}${phone}`, mode })
      setStep('otp')
    } catch (err) {
      const data = err.response?.data
      if (data?.hint === 'login') setMode('login')
      if (data?.hint === 'signup') setMode('signup')
      setError(data?.error || t('error_generic'))
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault()
    setError('')
    if (otp.length !== 6) { setError(t('invalid_otp')); return }
    setLoading(true)
    try {
      const { data } = await axios.post('/api/auth/verify-otp', {
        phone_number: `${countryCodeRef.current}${phone}`,
        otp_code: otp,
      })
      login(data.token, data.user)
      if (data.isNewUser) {
        setSavedToken(data.token)
        setShowNameModal(true)
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err.response?.data?.error || t('error_generic'))
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveName(e) {
    e.preventDefault()
    if (!nameInput.trim()) return
    setNameLoading(true)
    setNameError('')
    try {
      const { data } = await axios.patch(
        '/api/auth/profile',
        { name: nameInput.trim() },
        { headers: { Authorization: `Bearer ${savedToken || token}` } }
      )
      updateUser(data.user)
      navigate('/dashboard')
    } catch (err) {
      setNameError(err.response?.data?.error || t('error_generic'))
    } finally {
      setNameLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen font-sans flex flex-col items-center justify-center px-4"
      style={{
        background: `
          radial-gradient(ellipse at 80% 30%, rgba(199,243,108,0.62) 0%, transparent 55%),
          radial-gradient(ellipse at 50% 50%, rgba(199,243,108,0.38) 0%, transparent 55%),
          radial-gradient(ellipse at 20% 65%, rgba(199,243,108,0.48) 0%, transparent 50%),
          radial-gradient(ellipse at 60% 80%, rgba(199,243,108,0.32) 0%, transparent 45%),
          #ffffff
        `.replace(/\s+/g, ' ').trim(),
      }}
    >

      {/* Card */}
      <div className="w-full max-w-sm bg-card border border-ink-200/60 rounded-3xl p-8 shadow-2xl">

        <div className="mb-7 text-center">
          <img src={logo} alt="Meditrack" className="h-10 mx-auto mb-3" />
          <p className="text-ink-400 text-[15px] font-medium">{t('login_tagline')}</p>
        </div>

        {step === 'phone' && (
          <div className="flex bg-ink-200/40 rounded-xl p-1 mb-6">
            <button
              type="button"
              onClick={() => { setMode('login'); setError('') }}
              className={`flex-1 text-[15px] font-semibold py-2.5 rounded-lg transition-all ${
                mode === 'login' ? 'bg-card text-ink-900 shadow-sm' : 'text-ink-400 hover:text-ink-900'
              }`}
            >
              {t('log_in')}
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError('') }}
              className={`flex-1 text-[15px] font-semibold py-2.5 rounded-lg transition-all ${
                mode === 'signup' ? 'bg-card text-ink-900 shadow-sm' : 'text-ink-400 hover:text-ink-900'
              }`}
            >
              {t('sign_up')}
            </button>
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleSendOtp} className="space-y-5">
            <div>
              <label className="block text-[13px] font-semibold text-ink-600 uppercase tracking-widest mb-2">
                {t('phone_label')}
              </label>
              <div className="flex items-stretch border-2 border-ink-200 rounded-xl overflow-hidden focus-within:border-accent-500 transition-colors">
                <div className="relative shrink-0 border-r-2 border-ink-200">
                  <select
                    value={countryCode}
                    onChange={(e) => { countryCodeRef.current = e.target.value; setCountryCode(e.target.value); setPhone('') }}
                    className="bg-white text-ink-900 text-[17px] font-bold pl-3 pr-7 py-4 outline-none cursor-pointer appearance-none h-full"
                  >
                    {COUNTRY_CODES.map(c => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400">
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={selectedCountry.maxLen}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder={t('phone_placeholder')}
                  className="flex-1 min-w-0 px-4 py-4 text-[17px] font-medium text-ink-900 placeholder-ink-400 outline-none bg-white"
                />
              </div>
            </div>
            {error && <p className="text-[13px] text-red-500 font-medium">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent-500 hover:bg-accent-600 disabled:opacity-40 text-white text-[16px] font-semibold py-4 rounded-xl transition-all duration-150 shadow-md hover:shadow-lg mt-1"
            >
              {loading ? t('sending') : t('send_otp')}
            </button>
          </form>

        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <p className="text-[15px] text-ink-400 font-medium">{t('otp_sent', { phone })}</p>
            <div>
              <label className="block text-[13px] font-semibold text-ink-600 uppercase tracking-widest mb-2">
                {t('otp_label')}
              </label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="— — — — — —"
                className="w-full border-2 border-ink-200 focus:border-accent-500 rounded-xl px-4 py-4 text-center text-2xl font-bold tracking-[0.5em] text-ink-900 outline-none transition-colors bg-white placeholder-ink-200"
                autoFocus
              />
            </div>
            {error && <p className="text-[13px] text-red-500 font-medium">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent-500 hover:bg-accent-600 disabled:opacity-40 text-white text-[16px] font-semibold py-4 rounded-xl transition-all duration-150 shadow-md hover:shadow-lg mt-1"
            >
              {loading ? t('verifying') : t('verify_otp')}
            </button>
            <div className="flex justify-between text-[13px] text-ink-400 pt-1">
              <button
                type="button"
                onClick={() => { setStep('phone'); setOtp(''); setError('') }}
                className="hover:text-ink-900 font-medium transition-colors"
              >
                {t('change_number')}
              </button>
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading}
                className="hover:text-ink-900 font-medium disabled:opacity-40 transition-colors"
              >
                {t('resend_otp')}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Terms */}
      <p className="mt-5 text-center text-[12px] text-ink-400 max-w-xs leading-relaxed">
        By signing up or logging in, you agree to our{' '}
        <a
          href="https://www.meditrack.in/terms-of-use"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-ink-900 transition-colors"
        >
          Terms of Use
        </a>
        .
      </p>

      {/* Name modal */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4 z-50">
          <div className="w-full max-w-sm bg-card rounded-3xl p-8 shadow-2xl border border-ink-200/60">
            <div className="mb-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-50 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgb(199, 243, 108)" className="w-6 h-6">
                  <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm4.28 10.28a.75.75 0 0 0 0-1.06l-3-3a.75.75 0 1 0-1.06 1.06l1.72 1.72H8.25a.75.75 0 0 0 0 1.5h5.69l-1.72 1.72a.75.75 0 1 0 1.06 1.06l3-3Z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-ink-900 tracking-tight">{t('welcome_name')}</h2>
              <p className="text-[15px] text-ink-400 mt-1">{t('what_call_you')}</p>
            </div>
            <form onSubmit={handleSaveName} className="space-y-5">
              <div>
                <label className="block text-[13px] font-semibold text-ink-600 uppercase tracking-widest mb-2">
                  {t('your_name')}
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder={t('name_placeholder')}
                  maxLength={60}
                  autoFocus
                  className="w-full border-2 border-ink-200 focus:border-accent-500 rounded-xl px-4 py-4 text-[17px] font-medium text-ink-900 placeholder-ink-400 outline-none transition-colors bg-white"
                />
              </div>
              {nameError && <p className="text-[13px] text-red-500 font-medium">{nameError}</p>}
              <button
                type="submit"
                disabled={nameLoading || !nameInput.trim()}
                className="w-full bg-accent-500 hover:bg-accent-600 disabled:opacity-40 text-white text-[16px] font-semibold py-4 rounded-xl transition-all duration-150 shadow-md hover:shadow-lg"
              >
                {nameLoading ? t('saving') : t('continue_btn')}
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="w-full text-[14px] font-medium text-ink-400 hover:text-ink-900 transition-colors py-1"
              >
                {t('skip_for_now')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
