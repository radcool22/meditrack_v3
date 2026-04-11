import { useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAnalysis } from '../hooks/useAnalysis'
import { useVoice } from '../hooks/useVoice'
import LangToggle from '../components/LangToggle'
import ChatPanel from '../components/ChatPanel'

const FLAG_STYLES = {
  HIGH:     'bg-red-50 border-red-200',
  LOW:      'bg-amber-50 border-amber-200',
  ABNORMAL: 'bg-orange-50 border-orange-200',
}

const FLAG_VALUE_COLOR = {
  HIGH:     'text-red-600',
  LOW:      'text-amber-500',
  ABNORMAL: 'text-orange-500',
}

function Spinner({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-9 h-9 border-[3px] border-ink-200 border-t-teal-600 rounded-full animate-spin" />
      <p className="text-[15px] font-medium text-ink-400">{label}</p>
    </div>
  )
}

export default function ReportPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation()
  const autoSpeak = searchParams.get('autoSpeak') === '1'

  const { analysis, status, loading, error, retry } = useAnalysis(id)
  const { connect, speak } = useVoice()

  const hasSpoken = useRef(false)

  useEffect(() => {
    if (!autoSpeak || !analysis?.summary || hasSpoken.current) return
    hasSpoken.current = true
    connect()
    speak(analysis.summary, 'en-IN')
  }, [autoSpeak, analysis?.summary])

  const isProcessing = status === 'processing' || (status === 'pending' && !analysis)

  return (
    <div className="min-h-screen bg-surface font-sans">
      {/* Top bar */}
      <header className="bg-card border-b border-ink-200/60 px-5 py-4 flex items-center gap-4 sticky top-0 z-10">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-[15px] font-semibold text-teal-700 hover:text-teal-900 transition-colors flex items-center gap-1.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
          </svg>
          {t('back')}
        </button>
        <div className="w-px h-5 bg-ink-200" />
        <h1 className="text-xl font-bold text-ink-900 tracking-tight flex-1">
          {t('report_analysis')}
        </h1>
        <LangToggle />
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {loading && !analysis && <Spinner label={t('analysing')} />}
        {isProcessing && <Spinner label={t('analysing')} />}

        {error && !isProcessing && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-5 space-y-3">
            <p className="text-[15px] font-semibold text-red-700">{t('analysis_failed')}</p>
            <p className="text-[13px] text-red-600 font-mono break-all">{error}</p>
            <button
              onClick={retry}
              className="text-[14px] font-semibold bg-teal-700 hover:bg-teal-600 text-white px-5 py-2.5 rounded-xl transition-colors shadow-sm"
            >
              {t('retry_analysis')}
            </button>
          </div>
        )}

        {analysis && (
          <>
            <section className="bg-card border border-ink-200/60 rounded-2xl p-6 shadow-sm border-l-4 border-l-teal-500">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-400 mb-3">
                {t('summary')}
              </h2>
              <p className="text-[15px] text-ink-900 leading-relaxed">{analysis.summary}</p>
            </section>

            {analysis.abnormal_values?.length > 0 && (
              <section className="bg-card border border-ink-200/60 rounded-2xl p-6 shadow-sm">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-400 mb-4">
                  {t('values_attention')}
                </h2>
                <div className="space-y-3">
                  {analysis.abnormal_values.map((item, i) => (
                    <div
                      key={i}
                      className={`border rounded-2xl px-5 py-4 ${FLAG_STYLES[item.flag] ?? 'bg-surface border-ink-200'}`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <span className="text-[15px] font-bold text-ink-900">{item.test}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[18px] font-extrabold ${FLAG_VALUE_COLOR[item.flag] ?? 'text-ink-900'}`}>
                            {item.value}
                          </span>
                          <span className={`text-[15px] font-bold ${FLAG_VALUE_COLOR[item.flag] ?? 'text-ink-600'}`}>
                            {item.flag === 'HIGH' ? '↑' : item.flag === 'LOW' ? '↓' : '!'}
                          </span>
                        </div>
                      </div>
                      <p className="text-[14px] text-ink-600 leading-relaxed mb-1">
                        {item.plain_explanation}
                      </p>
                      {item.normal_range && (
                        <p className="text-[13px] text-ink-400 font-medium">
                          {t('normal_range')} {item.normal_range}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {analysis.abnormal_values?.length === 0 && (
              <section className="bg-teal-50 border border-teal-200 rounded-2xl px-5 py-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#0f766e" className="w-5 h-5">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-[15px] font-semibold text-teal-900">{t('all_clear')}</p>
              </section>
            )}

            {analysis.suggestions?.length > 0 && (
              <section className="bg-card border border-ink-200/60 rounded-2xl p-6 shadow-sm">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-400 mb-4">
                  {t('what_you_can_do')}
                </h2>
                <ul className="space-y-3">
                  {analysis.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-teal-700 text-white text-[12px] font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-[15px] text-ink-900 leading-relaxed">{s}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {/* Report-specific chat — only shown once analysis is ready */}
        {analysis && (
          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-ink-200/60" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-400 shrink-0">
                {t('ask_about_report')}
              </h2>
              <div className="flex-1 h-px bg-ink-200/60" />
            </div>
            <ChatPanel
              reportId={id}
              isReportChat={true}
              greetingMessage={t('report_chat_greeting')}
            />
          </section>
        )}
      </main>
    </div>
  )
}
