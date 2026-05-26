import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import BottomNav from '../components/BottomNav'

// ── Shared field ─────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = 'number' }) {
  return (
    <label className="block">
      <span className="text-[12px] text-ink-400 font-semibold uppercase tracking-wide">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full border-2 border-ink-200 focus:border-accent-500 rounded-xl px-4 py-3 text-[16px] font-medium text-ink-900 outline-none bg-white transition-colors placeholder-ink-400"
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
            className={`flex-1 text-[14px] font-semibold py-2.5 rounded-lg transition-all capitalize ${
              value === g ? 'bg-white text-accent-500 shadow-sm' : 'text-ink-400 hover:text-ink-900'
            }`}
          >
            {g === 'male' ? t('male') : t('female')}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Result badge ─────────────────────────────────────────────
function ResultBadge({ label, value, unit, category, color }) {
  const colors = {
    green:  { bg: '#E8F5EC', fg: '#16A34A' },
    amber:  { bg: '#FEF4E1', fg: '#E8911F' },
    red:    { bg: '#FDECEC', fg: '#E5484D' },
    blue:   { bg: '#EEF4FF', fg: '#3478F7' },
  }
  const c = colors[color] ?? colors.blue
  return (
    <div
      className="mt-4 rounded-2xl p-4 flex items-center gap-4"
      style={{ background: c.bg }}
    >
      <div>
        <p className="text-[36px] font-extrabold leading-none" style={{ color: c.fg, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </p>
        {unit && <p className="text-[13px] font-medium text-ink-400 mt-0.5">{unit}</p>}
      </div>
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-ink-400">{label}</p>
        <p className="text-[17px] font-bold mt-0.5" style={{ color: c.fg }}>{category}</p>
      </div>
    </div>
  )
}

// ── BMI ──────────────────────────────────────────────────────
function BMICalc() {
  const { t } = useTranslation()
  const [height, setHeight] = useState('170')
  const [weight, setWeight] = useState('72')

  const bmi = height && weight && +height > 0
    ? (+weight / Math.pow(+height / 100, 2)).toFixed(1)
    : null

  function category(b) {
    const n = parseFloat(b)
    if (n < 18.5) return { label: t('bmi_underweight'), color: 'amber' }
    if (n < 25)   return { label: t('bmi_normal'),      color: 'green' }
    if (n < 30)   return { label: t('bmi_overweight'),  color: 'amber' }
    return               { label: t('bmi_obese'),        color: 'red'   }
  }

  const cat = bmi ? category(bmi) : null
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('height_cm')} value={height} onChange={setHeight} placeholder="170" />
        <Field label={t('weight_kg')} value={weight} onChange={setWeight} placeholder="72" />
      </div>
      {bmi && cat && (
        <ResultBadge label={t('your_bmi')} value={bmi} category={cat.label} color={cat.color} />
      )}
    </div>
  )
}

// ── Calorie ──────────────────────────────────────────────────
function CalorieCalc() {
  const { t } = useTranslation()
  const [age, setAge]         = useState('42')
  const [gender, setGender]   = useState('male')
  const [height, setHeight]   = useState('170')
  const [weight, setWeight]   = useState('72')
  const [activity, setActivity] = useState('1.375')

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
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('age')} value={age} onChange={setAge} placeholder="30" />
        <Field label={t('height_cm')} value={height} onChange={setHeight} placeholder="170" />
      </div>
      <Field label={t('weight_kg')} value={weight} onChange={setWeight} placeholder="72" />
      <GenderToggle value={gender} onChange={setGender} />
      <div>
        <span className="text-[12px] text-ink-400 font-semibold uppercase tracking-wide">{t('activity_level')}</span>
        <select
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
          className="mt-1.5 w-full border-2 border-ink-200 focus:border-accent-500 rounded-xl px-4 py-3 text-[15px] font-medium text-ink-900 bg-white outline-none transition-colors"
        >
          {activityLevels.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>
      {calories && (
        <ResultBadge
          label={t('daily_calories')}
          value={calories.toLocaleString('en-IN')}
          unit={t('kcal_day')}
          category=""
          color="blue"
        />
      )}
    </div>
  )
}

// ── VO2 Max ──────────────────────────────────────────────────
const VO2_NORMS = {
  male:   [
    { maxAge: 29, t: [35, 44, 52.5] },
    { maxAge: 39, t: [33.7, 42.5, 50.4] },
    { maxAge: 49, t: [32.2, 41.1, 48.7] },
    { maxAge: 59, t: [30.2, 39.0, 46.8] },
    { maxAge: 99, t: [25.1, 33.8, 42.5] },
  ],
  female: [
    { maxAge: 29, t: [29, 35, 43.1] },
    { maxAge: 39, t: [27, 34, 42.0] },
    { maxAge: 49, t: [24.5, 31.5, 39.5] },
    { maxAge: 59, t: [22.8, 29.0, 37.0] },
    { maxAge: 99, t: [21.7, 27.0, 36.0] },
  ],
}

function VO2Calc() {
  const { t } = useTranslation()
  const [age, setAge]         = useState('42')
  const [gender, setGender]   = useState('male')
  const [restingHR, setHR]    = useState('68')

  const vo2 = age && restingHR && +age > 0 && +restingHR > 0
    ? (15 * ((220 - +age) / +restingHR)).toFixed(1)
    : null

  function category(v, a, g) {
    const norms  = VO2_NORMS[g]
    const bucket = norms.find((n) => +a <= n.maxAge) ?? norms[norms.length - 1]
    const [poor, fair, good] = bucket.t
    if (v < poor) return { label: t('vo2_poor'),      color: 'red'   }
    if (v < fair) return { label: t('vo2_fair'),       color: 'amber' }
    if (v < good) return { label: t('vo2_good'),       color: 'blue'  }
    return               { label: t('vo2_excellent'),  color: 'green' }
  }

  const cat = vo2 ? category(parseFloat(vo2), age, gender) : null
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('age')} value={age} onChange={setAge} placeholder="42" />
        <Field label={t('resting_hr')} value={restingHR} onChange={setHR} placeholder="68" />
      </div>
      <GenderToggle value={gender} onChange={setGender} />
      {vo2 && cat && (
        <ResultBadge
          label={t('estimated_vo2')}
          value={vo2}
          unit={t('ml_kg_min')}
          category={cat.label}
          color={cat.color}
        />
      )}
    </div>
  )
}

// ── Accordion card ───────────────────────────────────────────
function CalcCard({ open, onToggle, iconBg, iconColor, emoji, title, subtitle, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(30,25,15,0.04), 0 8px 24px rgba(30,25,15,0.06)' }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 bg-transparent border-none cursor-pointer text-left"
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-xl"
          style={{ background: iconBg, color: iconColor }}
        >
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-bold text-ink-900 leading-snug">{title}</p>
          <p className="text-[13px] text-ink-400 mt-0.5">{subtitle}</p>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
          className={`w-5 h-5 text-ink-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-ink-200/60">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────
export default function CalculatorsPage() {
  const { t } = useTranslation()
  const [open, setOpen] = useState('bmi')

  const toggle = (id) => setOpen((prev) => (prev === id ? null : id))

  return (
    <div className="min-h-screen bg-surface font-sans pb-28">
      <header className="bg-card border-b border-ink-200/60 px-5 pt-14 pb-5 sticky top-0 z-10">
        <h1 className="text-[28px] font-extrabold text-ink-900 tracking-tight leading-tight">
          {t('health_tools')}
        </h1>
        <p className="text-[15px] text-ink-400 mt-1 font-medium">{t('quick_calculators')}</p>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <CalcCard
          open={open === 'bmi'} onToggle={() => toggle('bmi')}
          emoji="⚖️" iconBg="#EEF4FF" iconColor="#3478F7"
          title={t('bmi_calculator')} subtitle="Body mass index"
        >
          <BMICalc />
        </CalcCard>

        <CalcCard
          open={open === 'cal'} onToggle={() => toggle('cal')}
          emoji="🔥" iconBg="#FEF4E1" iconColor="#E8911F"
          title={t('calorie_calculator')} subtitle="Daily calorie needs"
        >
          <CalorieCalc />
        </CalcCard>

        <CalcCard
          open={open === 'vo2'} onToggle={() => toggle('vo2')}
          emoji="❤️" iconBg="#E8F5EC" iconColor="#16A34A"
          title={t('vo2_estimator')} subtitle="Cardio fitness score"
        >
          <VO2Calc />
        </CalcCard>
      </main>

      <BottomNav />
    </div>
  )
}
