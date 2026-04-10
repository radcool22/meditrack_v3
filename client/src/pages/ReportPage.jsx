import { useParams, useNavigate } from 'react-router-dom'
import { useAnalysis } from '../hooks/useAnalysis'

const FLAG_STYLES = {
  HIGH:     'bg-red-50 text-red-600 border-red-200',
  LOW:      'bg-blue-50 text-blue-600 border-blue-200',
  ABNORMAL: 'bg-yellow-50 text-yellow-700 border-yellow-200',
}

function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-8 h-8 border-2 border-[#e0e0e0] border-t-[#181818] rounded-full animate-spin" />
      <p className="text-sm text-[#8e8e8e]">Analysing your report…</p>
    </div>
  )
}

export default function ReportPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { analysis, status, loading, error, retry } = useAnalysis(id)

  const isProcessing = status === 'processing' || (status === 'pending' && !analysis)

  return (
    <div className="min-h-screen bg-[#f5f5f5] font-sans">
      {/* Top bar */}
      <header className="bg-white border-b border-[#e0e0e0] px-5 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-xs font-medium text-[#8e8e8e] hover:text-[#181818] transition-colors"
        >
          ← Back
        </button>
        <h1 className="font-serif text-xl font-bold text-[#181818] tracking-tight">
          Report Analysis
        </h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {loading && !analysis && <Spinner />}
        {isProcessing && <Spinner />}

        {error && !isProcessing && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 space-y-3">
            <p className="text-sm font-medium text-red-700">Analysis failed</p>
            <p className="text-xs text-red-600 font-mono break-all">{error}</p>
            <button
              onClick={retry}
              className="text-xs font-medium bg-[#181818] text-white px-4 py-2 rounded-lg hover:bg-[#333] transition-colors"
            >
              Retry Analysis
            </button>
          </div>
        )}

        {analysis && (
          <>
            {/* Summary */}
            <section className="bg-white border border-[#e0e0e0] rounded-xl p-6">
              <h2 className="text-xs font-medium uppercase tracking-widest text-[#8e8e8e] mb-3">
                Summary
              </h2>
              <p className="text-sm text-[#181818] leading-relaxed">{analysis.summary}</p>
            </section>

            {/* Abnormal values */}
            {analysis.abnormal_values?.length > 0 && (
              <section className="bg-white border border-[#e0e0e0] rounded-xl p-6">
                <h2 className="text-xs font-medium uppercase tracking-widest text-[#8e8e8e] mb-4">
                  Values That Need Attention
                </h2>
                <div className="space-y-3">
                  {analysis.abnormal_values.map((item, i) => (
                    <div
                      key={i}
                      className={`border rounded-lg px-4 py-3 ${FLAG_STYLES[item.flag] ?? 'bg-[#f5f5f5] border-[#e0e0e0]'}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{item.test}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-semibold">{item.value}</span>
                          <span className="text-xs opacity-60">
                            {item.flag === 'HIGH' ? '↑' : item.flag === 'LOW' ? '↓' : '!'}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs opacity-75 leading-relaxed">
                        {item.plain_explanation}
                      </p>
                      {item.normal_range && (
                        <p className="text-xs opacity-50 mt-1">
                          Normal range: {item.normal_range}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* All clear if no abnormal values */}
            {analysis.abnormal_values?.length === 0 && (
              <section className="bg-[#bbf451]/10 border border-[#bbf451] rounded-xl px-5 py-4">
                <p className="text-sm font-medium text-[#181818]">
                  All values are within the normal range.
                </p>
              </section>
            )}

            {/* Suggestions */}
            {analysis.suggestions?.length > 0 && (
              <section className="bg-white border border-[#e0e0e0] rounded-xl p-6">
                <h2 className="text-xs font-medium uppercase tracking-widest text-[#8e8e8e] mb-4">
                  What You Can Do
                </h2>
                <ul className="space-y-2">
                  {analysis.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#181818]">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#bbf451] shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </section>
            )}

          </>
        )}
      </main>
    </div>
  )
}
