import logo from '../assets/logo.svg'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useReports } from '../hooks/useReports'
import UploadZone from '../components/UploadZone'
import ReportCard from '../components/ReportCard'
import ChatPanel from '../components/ChatPanel'
import LangToggle from '../components/LangToggle'

export default function DashboardPage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const { reports, loading, error, upload, deleteReport } = useReports()

  const hasDoneReports = reports.some((r) => r.status === 'done')

  return (
    <div className="min-h-screen bg-surface font-sans">
      {/* Top navbar */}
      <header className="bg-card border-b border-ink-200/60 px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center">
          <img src={logo} alt="Meditrack" className="h-7" />
        </div>
        <div className="flex items-center gap-3">
          <LangToggle />
          <span className="text-[14px] font-medium text-ink-400 hidden sm:block">{user?.phone_number}</span>
          <button
            onClick={logout}
            className="text-[14px] font-semibold text-ink-600 border border-ink-200 rounded-xl px-4 py-2 hover:bg-surface hover:text-ink-900 transition-colors"
          >
            {t('logout')}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {user?.name && (
          <div>
            <h2 className="text-3xl font-bold text-ink-900">
              {t('hello')}, {user.name} 👋
            </h2>
            <p className="text-[15px] text-ink-400 mt-1 font-medium">{t('health_dashboard')}</p>
          </div>
        )}

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-400 mb-4">
            {t('upload_report_section')}
          </h2>
          <UploadZone onUpload={upload} />
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-400 mb-4">
            {t('ask_about_reports')}
          </h2>
          {!loading && !hasDoneReports ? (
            <div className="bg-card rounded-2xl border border-ink-200/60 shadow-sm px-6 py-8 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-50 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgb(199, 243, 108)" className="w-6 h-6">
                  <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.17l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.17 48.9 48.9 0 0 1-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97Z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-[15px] font-medium text-ink-600">{t('upload_first')}</p>
            </div>
          ) : (
            <ChatPanel />
          )}
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-400 mb-4">
            {t('your_reports')}
          </h2>
          {loading ? (
            <div className="flex items-center gap-3 py-4">
              <div className="w-5 h-5 border-2 border-ink-200 border-t-teal-600 rounded-full animate-spin" />
              <p className="text-[15px] text-ink-400 font-medium">{t('loading')}</p>
            </div>
          ) : error ? (
            <p className="text-[15px] text-red-500 font-medium">{error}</p>
          ) : reports.length === 0 ? (
            <p className="text-[15px] text-ink-400 font-medium">{t('no_reports')}</p>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <ReportCard key={r.id} report={r} onDelete={deleteReport} />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="py-6 text-center text-[12px] text-ink-400">
        <a
          href="https://www.meditrack.in/terms-of-use"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-ink-900 transition-colors"
        >
          Terms of Use
        </a>
      </footer>
    </div>
  )
}
