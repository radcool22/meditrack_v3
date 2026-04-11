import { useState } from 'react'
import { useTranslation } from 'react-i18next'

// ── Shared input ─────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = 'number' }) {
  return (
    <label className="block">
      <span className="text-[12px] text-ink-400 font-semibold uppercase tracking-wide">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full border-2 border-ink-200 focus:border-accent-500 rounded-xl px-3 py-2.5 text-[15px] font-medium text-ink-900 outline-none bg-white transition-colors placeholder-ink-400"
      />
    </label>
  )
}

function GenderToggle({ value, onChange }) {
  const { t } = useTranslation()
  return (
    <div>
      <span className="text-[12px] text-ink-400 font-semibold uppercase tracking-wide">{t('gender')}</span>
      <div className="mt-1.5 flex bg-surface border border-ink-200 rounded-xl p-0.5">
        {['male', 'female'].map((g) => (
          <button
            key={g}
            onClick={() => onChange(g)}
            className={`flex-1 text-[13px] font-semibold py-2 rounded-lg transition-all capitalize ${
              value === g ? 'bg-card text-accent-500 shadow-sm' : 'text-ink-400 hover:text-ink-900'
            }`}
          >
            {g === 'male' ? t('male') : t('female')}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── BMI Calculator ───────────────────────────────────────────────────
function BMICalc() {
  const { t } = useTranslation()
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')

  const bmi = height && weight && +height > 0
    ? (+weight / Math.pow(+height / 100, 2)).toFixed(1)
    : null

  const getCategory = (b) => {
    if (b < 18.5) return { label: t('bmi_underweight'), cls: 'text-blue-600 bg-blue-50 border-blue-200' }
    if (b < 25)   return { label: t('bmi_normal'),      cls: 'text-green-700 bg-green-50 border-green-200' }
    if (b < 30)   return { label: t('bmi_overweight'),  cls: 'text-yellow-700 bg-yellow-50 border-yellow-200' }
    return               { label: t('bmi_obese'),        cls: 'text-red-600 bg-red-50 border-red-200' }
  }

  const cat = bmi ? getCategory(parseFloat(bmi)) : null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label={t('height_cm')} value={height} onChange={setHeight} placeholder="170" />
        <Field label={t('weight_kg')} value={weight} onChange={setWeight} placeholder="70" />
      </div>
      {bmi && cat && (
        <div className="flex items-center justify-between bg-surface border border-ink-200/60 rounded-xl px-4 py-3">
          <div>
            <p className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide">{t('your_bmi')}</p>
            <p className="text-2xl font-extrabold text-ink-900 leading-tight">{bmi}</p>
          </div>
          <span className={`text-[12px] font-bold px-3 py-1.5 rounded-full border ${cat.cls}`}>
            {cat.label}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Calorie Calculator (Mifflin-St Jeor) ────────────────────────────
function CalorieCalc() {
  const { t } = useTranslation()
  const [age, setAge]       = useState('')
  const [gender, setGender] = useState('male')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [activity, setActivity] = useState('1.55')

  const activityLevels = [
    { value: '1.2',   label: t('sedentary') },
    { value: '1.375', label: t('lightly_active') },
    { value: '1.55',  label: t('moderately_active') },
    { value: '1.725', label: t('very_active') },
  ]

  const calories = age && height && weight && +age > 0
    ? Math.round(
        ((10 * +weight) + (6.25 * +height) - (5 * +age) + (gender === 'male' ? 5 : -161))
        * parseFloat(activity)
      )
    : null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label={t('age')} value={age} onChange={setAge} placeholder="30" />
        <Field label={t('height_cm')} value={height} onChange={setHeight} placeholder="170" />
      </div>
      <Field label={t('weight_kg')} value={weight} onChange={setWeight} placeholder="70" />
      <GenderToggle value={gender} onChange={setGender} />
      <div>
        <span className="text-[12px] text-ink-400 font-semibold uppercase tracking-wide">{t('activity_level')}</span>
        <select
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
          className="mt-1.5 w-full border-2 border-ink-200 focus:border-accent-500 rounded-xl px-3 py-2.5 text-[13px] font-medium text-ink-900 bg-white outline-none transition-colors"
        >
          {activityLevels.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>
      {calories && (
        <div className="bg-surface border border-ink-200/60 rounded-xl px-4 py-3">
          <p className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide">{t('daily_calories')}</p>
          <p className="text-2xl font-extrabold text-ink-900 leading-tight">
            {calories.toLocaleString('en-IN')}
            <span className="text-[14px] font-medium text-ink-400 ml-1">{t('kcal_day')}</span>
          </p>
        </div>
      )}
    </div>
  )
}

// ── VO2 Max Estimator ────────────────────────────────────────────────
const VO2_NORMS = {
  male: [
    { maxAge: 29, thresholds: [35, 44, 52.5] },
    { maxAge: 39, thresholds: [33.7, 42.5, 50.4] },
    { maxAge: 49, thresholds: [32.2, 41.1, 48.7] },
    { maxAge: 59, thresholds: [30.2, 39.0, 46.8] },
    { maxAge: 99, thresholds: [25.1, 33.8, 42.5] },
  ],
  female: [
    { maxAge: 29, thresholds: [29, 35, 43.1] },
    { maxAge: 39, thresholds: [27, 34, 42.0] },
    { maxAge: 49, thresholds: [24.5, 31.5, 39.5] },
    { maxAge: 59, thresholds: [22.8, 29.0, 37.0] },
    { maxAge: 99, thresholds: [21.7, 27.0, 36.0] },
  ],
}

function getVO2Category(vo2, age, gender, t) {
  const norms = VO2_NORMS[gender]
  const bucket = norms.find((n) => age <= n.maxAge) ?? norms[norms.length - 1]
  const [poor, fair, good] = bucket.thresholds
  if (vo2 < poor) return { label: t('vo2_poor'),      cls: 'text-red-600 bg-red-50 border-red-200' }
  if (vo2 < fair) return { label: t('vo2_fair'),      cls: 'text-yellow-700 bg-yellow-50 border-yellow-200' }
  if (vo2 < good) return { label: t('vo2_good'),      cls: 'text-blue-600 bg-blue-50 border-blue-200' }
  return               { label: t('vo2_excellent'),   cls: 'text-green-700 bg-green-50 border-green-200' }
}

function VO2Calc() {
  const { t } = useTranslation()
  const [age, setAge]           = useState('')
  const [gender, setGender]     = useState('male')
  const [restingHR, setRestingHR] = useState('')

  const vo2 =
    age && restingHR && +age > 0 && +restingHR > 0
      ? Math.round(15 * ((220 - +age) / +restingHR))
      : null

  const cat = vo2 ? getVO2Category(vo2, +age, gender, t) : null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label={t('age')} value={age} onChange={setAge} placeholder="30" />
        <Field label={t('resting_hr')} value={restingHR} onChange={setRestingHR} placeholder="65" />
      </div>
      <GenderToggle value={gender} onChange={setGender} />
      {vo2 && cat && (
        <div className="bg-surface border border-ink-200/60 rounded-xl px-4 py-3">
          <p className="text-[12px] font-semibold text-ink-400 uppercase tracking-wide">{t('estimated_vo2')}</p>
          <div className="flex items-end justify-between mt-0.5">
            <p className="text-2xl font-extrabold text-ink-900 leading-tight">
              {vo2}
              <span className="text-[14px] font-medium text-ink-400 ml-1">{t('ml_kg_min')}</span>
            </p>
            <span className={`text-[12px] font-bold px-3 py-1.5 rounded-full border ${cat.cls}`}>
              {cat.label}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Collapsible section ──────────────────────────────────────────────
function CalcSection({ title, icon, iconBg, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-card border border-ink-200/60 rounded-2xl overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-surface transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
            <span className="text-base leading-none">{icon}</span>
          </div>
          <span className="text-[15px] font-semibold text-ink-900">{title}</span>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-4 h-4 text-ink-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-ink-200/60">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Sidebar panel content ────────────────────────────────────────────
function SidebarContent() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col h-full">
      <div className="bg-black px-5 pt-5 pb-4">
        <h2 className="text-[17px] font-bold text-white tracking-tight">{t('health_tools')}</h2>
        <p className="text-[13px] text-white/60 mt-0.5 font-medium">{t('quick_calculators')}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-surface">
        <CalcSection title={t('bmi_calculator')} icon="⚖️" iconBg="bg-teal-100">
          <BMICalc />
        </CalcSection>
        <CalcSection title={t('calorie_calculator')} icon="🔥" iconBg="bg-amber-100">
          <CalorieCalc />
        </CalcSection>
        <CalcSection title={t('vo2_estimator')} icon="❤️" iconBg="bg-orange-100">
          <VO2Calc />
        </CalcSection>
      </div>
    </div>
  )
}

// ── Main export ──────────────────────────────────────────────────────
export default function HealthSidebar() {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()

  return (
    <>
      {/* ── Desktop: fixed panel on the right ── */}
      <div className="hidden lg:block">
        <div
          className={`fixed top-0 right-0 h-full w-72 bg-surface border-l border-ink-200/60 z-40 shadow-xl transition-transform duration-300 ease-in-out ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <button
            onClick={() => setOpen(false)}
            aria-label="Close health tools"
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors z-10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
          <SidebarContent />
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle health tools"
          className={`fixed top-1/2 -translate-y-1/2 z-50 transition-all duration-300 ease-in-out ${
            open ? 'right-72' : 'right-0'
          }`}
        >
          <div className="bg-black hover:bg-ink-600 text-white flex items-center justify-center rounded-l-xl w-8 py-7 transition-colors shadow-lg">
            <span
              className="text-[11px] font-bold tracking-widest uppercase whitespace-nowrap"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              {t('health_tools')}
            </span>
          </div>
        </button>
      </div>

      {/* ── Mobile: floating button + bottom drawer ── */}
      <div className="lg:hidden">
        {!open && (
          <button
            onClick={() => setOpen(true)}
            aria-label="Open health tools"
            className="fixed bottom-5 right-5 z-50 w-14 h-14 bg-black hover:bg-ink-600 text-white rounded-full flex items-center justify-center shadow-xl transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
            </svg>
          </button>
        )}

        {open && (
          <div
            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
        )}

        <div
          className={`fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-3xl shadow-2xl transition-transform duration-300 ease-in-out ${
            open ? 'translate-y-0' : 'translate-y-full'
          }`}
          style={{ maxHeight: '85vh' }}
        >
          <div className="flex items-center justify-between px-4 pt-4 pb-2 relative">
            <div className="w-10 h-1 bg-ink-200 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
            <div />
            <button
              onClick={() => setOpen(false)}
              className="text-ink-400 hover:text-ink-900 transition-colors ml-auto"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 56px)' }}>
            <SidebarContent />
          </div>
        </div>
      </div>
    </>
  )
}
