import { useAuth } from '../context/AuthContext'
import { useReports } from '../hooks/useReports'
import UploadZone from '../components/UploadZone'
import ReportCard from '../components/ReportCard'
import ChatPanel from '../components/ChatPanel'

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const { reports, loading, error, upload, deleteReport } = useReports()

  const hasDoneReports = reports.some((r) => r.status === 'done')

  return (
    <div className="min-h-screen bg-[#f5f5f5] font-sans">
      {/* Top bar */}
      <header className="bg-white border-b border-[#e0e0e0] px-5 py-4 flex items-center justify-between">
        <h1 className="font-serif text-xl font-bold text-[#181818] tracking-tight">MediTrack</h1>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#8e8e8e] hidden sm:block">{user?.phone_number}</span>
          <button
            onClick={logout}
            className="text-xs font-medium text-[#181818] border border-[#e0e0e0] rounded px-3 py-1.5 hover:bg-[#f5f5f5] transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Greeting */}
        {user?.name && (
          <h2 className="font-serif text-2xl font-bold text-[#181818] tracking-tight">
            Hello, {user.name}
          </h2>
        )}

        {/* Upload section */}
        <section>
          <h2 className="text-xs font-medium uppercase tracking-widest text-[#8e8e8e] mb-3">
            Upload Report
          </h2>
          <UploadZone onUpload={upload} />
        </section>

        {/* Chat section */}
        <section>
          <h2 className="text-xs font-medium uppercase tracking-widest text-[#8e8e8e] mb-3">
            Ask About Your Reports
          </h2>
          {!loading && !hasDoneReports ? (
            <p className="text-sm text-[#8e8e8e]">Upload and analyse a report to start chatting.</p>
          ) : (
            <ChatPanel />
          )}
        </section>

        {/* Reports list */}
        <section>
          <h2 className="text-xs font-medium uppercase tracking-widest text-[#8e8e8e] mb-3">
            Your Reports
          </h2>

          {loading ? (
            <p className="text-sm text-[#8e8e8e]">Loading…</p>
          ) : error ? (
            <p className="text-sm text-red-500">{error}</p>
          ) : reports.length === 0 ? (
            <p className="text-sm text-[#8e8e8e]">No reports yet. Upload your first one above.</p>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <ReportCard key={r.id} report={r} onDelete={deleteReport} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
