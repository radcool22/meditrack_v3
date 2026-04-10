import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import axios from 'axios'

const PHONE_RE = /^[6-9]\d{9}$/
const DEV_TEST_PHONE = '0000000000'

export default function LoginPage() {
  const { t } = useTranslation()
  const { login, updateUser, token } = useAuth()
  const { language, switchLanguage } = useLanguage()
  const navigate = useNavigate()

  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('phone') // 'phone' | 'otp'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Name modal state
  const [showNameModal, setShowNameModal] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [nameLoading, setNameLoading] = useState(false)
  const [nameError, setNameError] = useState('')
  const [savedToken, setSavedToken] = useState(null)

  async function handleSendOtp(e) {
    e.preventDefault()
    setError('')
    if (!PHONE_RE.test(phone) && phone !== DEV_TEST_PHONE) {
      setError(t('invalid_phone'))
      return
    }
    setLoading(true)
    try {
      await axios.post('/api/auth/send-otp', { phone_number: `+91${phone}`, mode })
      setStep('otp')
    } catch (err) {
      const data = err.response?.data
      if (data?.hint === 'login') {
        setMode('login')
      }
      setError(data?.error || t('error_generic'))
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault()
    setError('')
    if (otp.length !== 6) {
      setError(t('invalid_otp'))
      return
    }
    setLoading(true)
    try {
      const { data } = await axios.post('/api/auth/verify-otp', {
        phone_number: `+91${phone}`,
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
      setNameError(err.response?.data?.error || 'Failed to save name')
    } finally {
      setNameLoading(false)
    }
  }

  function handleSkipName() {
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] font-sans flex flex-col items-center justify-center px-4">

      {/* Language toggle */}
      <button
        onClick={() => switchLanguage(language === 'en' ? 'hi' : 'en')}
        className="absolute top-5 right-5 text-xs font-medium text-[#181818] border border-[#e0e0e0] rounded px-3 py-1.5 bg-white hover:bg-[#f5f5f5] transition-colors tracking-wide"
      >
        {t('lang_switch')}
      </button>

      {/* Card */}
      <div className="w-full max-w-sm bg-white border border-[#e0e0e0] rounded-xl p-8">

        {/* Logo / title */}
        <div className="mb-6">
          <h1 className="font-serif text-3xl font-bold text-[#181818] tracking-tight">
            {t('app_name')}
          </h1>
          <p className="text-[#8e8e8e] text-sm mt-1.5 font-light">
            {t('tagline')}
          </p>
        </div>

        {/* Mode toggle — only show on phone step */}
        {step === 'phone' && (
          <div className="flex bg-[#f5f5f5] rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => { setMode('login'); setError('') }}
              className={`flex-1 text-xs font-medium py-2 rounded-md transition-colors ${
                mode === 'login'
                  ? 'bg-white text-[#181818] shadow-sm'
                  : 'text-[#8e8e8e] hover:text-[#181818]'
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError('') }}
              className={`flex-1 text-xs font-medium py-2 rounded-md transition-colors ${
                mode === 'signup'
                  ? 'bg-white text-[#181818] shadow-sm'
                  : 'text-[#8e8e8e] hover:text-[#181818]'
              }`}
            >
              Sign Up
            </button>
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#181818] uppercase tracking-widest mb-2">
                {t('phone_label')}
              </label>
              <div className="flex items-stretch border border-[#e0e0e0] rounded-lg overflow-hidden focus-within:border-[#181818] transition-colors">
                <span className="px-3 flex items-center bg-[#f5f5f5] text-[#8e8e8e] text-sm border-r border-[#e0e0e0] select-none">
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder={t('phone_placeholder')}
                  className="flex-1 px-3 py-3 text-sm text-[#181818] placeholder-[#8e8e8e] outline-none bg-white"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#181818] hover:bg-[#bbf451] hover:text-[#181818] disabled:opacity-40 text-white text-sm font-medium py-3 rounded-lg transition-colors duration-150 mt-2"
            >
              {loading ? t('sending') : t('send_otp')}
            </button>
          </form>

        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-sm text-[#8e8e8e]">
              {t('otp_sent', { phone })}
            </p>

            <div>
              <label className="block text-xs font-medium text-[#181818] uppercase tracking-widest mb-2">
                {t('otp_label')}
              </label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="— — — — — —"
                className="w-full border border-[#e0e0e0] focus:border-[#181818] rounded-lg px-4 py-3 text-center text-xl tracking-[0.5em] text-[#181818] outline-none transition-colors bg-white placeholder-[#e0e0e0]"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#181818] hover:bg-[#bbf451] hover:text-[#181818] disabled:opacity-40 text-white text-sm font-medium py-3 rounded-lg transition-colors duration-150 mt-2"
            >
              {loading ? t('verifying') : t('verify_otp')}
            </button>

            <div className="flex justify-between text-xs text-[#8e8e8e] pt-1">
              <button
                type="button"
                onClick={() => { setStep('phone'); setOtp(''); setError('') }}
                className="hover:text-[#181818] transition-colors"
              >
                {t('change_number')}
              </button>
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading}
                className="hover:text-[#181818] disabled:opacity-40 transition-colors"
              >
                {t('resend_otp')}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Name modal — shown after sign-up OTP verification */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center px-4 z-50">
          <div className="w-full max-w-sm bg-white rounded-xl p-8 shadow-xl">
            <h2 className="font-serif text-2xl font-bold text-[#181818] tracking-tight mb-1">
              Welcome!
            </h2>
            <p className="text-sm text-[#8e8e8e] mb-6">
              What should we call you?
            </p>

            <form onSubmit={handleSaveName} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#181818] uppercase tracking-widest mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Rahul"
                  maxLength={60}
                  autoFocus
                  className="w-full border border-[#e0e0e0] focus:border-[#181818] rounded-lg px-4 py-3 text-sm text-[#181818] placeholder-[#8e8e8e] outline-none transition-colors bg-white"
                />
              </div>

              {nameError && (
                <p className="text-xs text-red-500">{nameError}</p>
              )}

              <button
                type="submit"
                disabled={nameLoading || !nameInput.trim()}
                className="w-full bg-[#181818] hover:bg-[#bbf451] hover:text-[#181818] disabled:opacity-40 text-white text-sm font-medium py-3 rounded-lg transition-colors duration-150"
              >
                {nameLoading ? 'Saving…' : 'Continue'}
              </button>

              <button
                type="button"
                onClick={handleSkipName}
                className="w-full text-xs text-[#8e8e8e] hover:text-[#181818] transition-colors py-1"
              >
                Skip for now
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
