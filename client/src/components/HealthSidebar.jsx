import { useState } from 'react'

// ── Shared input ─────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = 'number' }) {
  return (
    <label className="block">
      <span className="text-[11px] text-[#8e8e8e] font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full border border-[#e0e0e0] rounded-lg px-2.5 py-2 text-sm text-[#181818] outline-none focus:border-[#181818] bg-white transition-colors"
      />
    </label>
  )
}

function GenderToggle({ value, onChange }) {
  return (
    <div>
      <span className="text-[11px] text-[#8e8e8e] font-medium">Gender</span>
      <div className="mt-1 flex bg-[#f5f5f5] rounded-lg p-0.5">
        {['male', 'female'].map((g) => (
          <button
            key={g}
            onClick={() => onChange(g)}
            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors capitalize ${
              value === g ? 'bg-white text-[#181818] shadow-sm' : 'text-[#8e8e8e]'
            }`}
          >
            {g === 'male' ? 'Male' : 'Female'}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── BMI Calculator ───────────────────────────────────────────────────
function BMICalc() {
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')

  const bmi = height && weight && +height > 0
    ? (+weight / Math.pow(+height / 100, 2)).toFixed(1)
    : null

  const getCategory = (b) => {
    if (b < 18.5) return { label: 'Underweight', cls: 'text-blue-600 bg-blue-50 border-blue-200' }
    if (b < 25)   return { label: 'Normal',      cls: 'text-green-700 bg-green-50 border-green-200' }
    if (b < 30)   return { label: 'Overweight',  cls: 'text-yellow-700 bg-yellow-50 border-yellow-200' }
    return               { label: 'Obese',        cls: 'text-red-600 bg-red-50 border-red-200' }
  }

  const cat = bmi ? getCategory(parseFloat(bmi)) : null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Height (cm)" value={height} onChange={setHeight} placeholder="170" />
        <Field label="Weight (kg)" value={weight} onChange={setWeight} placeholder="70" />
      </div>
      {bmi && cat && (
        <div className="flex items-center justify-between bg-[#f9f9f9] border border-[#e0e0e0] rounded-lg px-3 py-2.5">
          <div>
            <p className="text-[11px] text-[#8e8e8e]">Your BMI</p>
            <p className="text-2xl font-bold text-[#181818] leading-tight">{bmi}</p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${cat.cls}`}>
            {cat.label}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Calorie Calculator (Mifflin-St Jeor) ────────────────────────────
const ACTIVITY_LEVELS = [
  { value: '1.2',   label: 'Sedentary (no exercise)' },
  { value: '1.375', label: 'Lightly active (1–3 days/wk)' },
  { value: '1.55',  label: 'Moderately active (3–5 days/wk)' },
  { value: '1.725', label: 'Very active (6–7 days/wk)' },
]

function CalorieCalc() {
  const [age, setAge]       = useState('')
  const [gender, setGender] = useState('male')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [activity, setActivity] = useState('1.55')

  const calories = age && height && weight && +age > 0
    ? Math.round(
        ((10 * +weight) + (6.25 * +height) - (5 * +age) + (gender === 'male' ? 5 : -161))
        * parseFloat(activity)
      )
    : null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Age" value={age} onChange={setAge} placeholder="30" />
        <Field label="Height (cm)" value={height} onChange={setHeight} placeholder="170" />
      </div>
      <Field label="Weight (kg)" value={weight} onChange={setWeight} placeholder="70" />
      <GenderToggle value={gender} onChange={setGender} />
      <div>
        <span className="text-[11px] text-[#8e8e8e] font-medium">Activity Level</span>
        <select
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
          className="mt-1 w-full border border-[#e0e0e0] rounded-lg px-2.5 py-2 text-xs text-[#181818] bg-white outline-none focus:border-[#181818]"
        >
          {ACTIVITY_LEVELS.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>
      {calories && (
        <div className="bg-[#f9f9f9] border border-[#e0e0e0] rounded-lg px-3 py-2.5">
          <p className="text-[11px] text-[#8e8e8e]">Daily Maintenance Calories</p>
          <p className="text-2xl font-bold text-[#181818] leading-tight">
            {calories.toLocaleString('en-IN')}
            <span className="text-sm font-normal text-[#8e8e8e] ml-1">kcal/day</span>
          </p>
        </div>
      )}
    </div>
  )
}

// ── VO2 Max Estimator ────────────────────────────────────────────────
// Age-gender norms from ACSM guidelines
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

const VO2_CATEGORIES = [
  { label: 'Poor',      cls: 'text-red-600 bg-red-50 border-red-200' },
  { label: 'Fair',      cls: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  { label: 'Good',      cls: 'text-blue-600 bg-blue-50 border-blue-200' },
  { label: 'Excellent', cls: 'text-green-700 bg-green-50 border-green-200' },
]

function getVO2Category(vo2, age, gender) {
  const norms = VO2_NORMS[gender]
  const bucket = norms.find((n) => age <= n.maxAge) ?? norms[norms.length - 1]
  const [poor, fair, good] = bucket.thresholds
  if (vo2 < poor) return VO2_CATEGORIES[0]
  if (vo2 < fair) return VO2_CATEGORIES[1]
  if (vo2 < good) return VO2_CATEGORIES[2]
  return VO2_CATEGORIES[3]
}

function VO2Calc() {
  const [age, setAge]           = useState('')
  const [gender, setGender]     = useState('male')
  const [restingHR, setRestingHR] = useState('')

  const vo2 =
    age && restingHR && +age > 0 && +restingHR > 0
      ? Math.round(15 * ((220 - +age) / +restingHR))
      : null

  const cat = vo2 ? getVO2Category(vo2, +age, gender) : null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Age" value={age} onChange={setAge} placeholder="30" />
        <Field label="Resting HR (bpm)" value={restingHR} onChange={setRestingHR} placeholder="65" />
      </div>
      <GenderToggle value={gender} onChange={setGender} />
      {vo2 && cat && (
        <div className="bg-[#f9f9f9] border border-[#e0e0e0] rounded-lg px-3 py-2.5">
          <p className="text-[11px] text-[#8e8e8e]">Estimated VO₂ Max</p>
          <div className="flex items-end justify-between mt-0.5">
            <p className="text-2xl font-bold text-[#181818] leading-tight">
              {vo2}
              <span className="text-sm font-normal text-[#8e8e8e] ml-1">ml/kg/min</span>
            </p>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${cat.cls}`}>
              {cat.label}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Collapsible section ──────────────────────────────────────────────
function CalcSection({ title, icon, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-[#e0e0e0] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-[#f9f9f9] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base">{icon}</span>
          <span className="text-sm font-medium text-[#181818]">{title}</span>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-4 h-4 text-[#8e8e8e] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && <div className="px-4 pb-4 pt-1 bg-white border-t border-[#e0e0e0]">{children}</div>}
    </div>
  )
}

// ── Sidebar panel content ────────────────────────────────────────────
function SidebarContent() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-5 pb-4 border-b border-[#e0e0e0]">
        <h2 className="font-serif text-lg font-bold text-[#181818] tracking-tight">Health Tools</h2>
        <p className="text-[11px] text-[#8e8e8e] mt-0.5">Quick reference calculators</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <CalcSection title="BMI Calculator" icon="⚖️">
          <BMICalc />
        </CalcSection>
        <CalcSection title="Calorie Calculator" icon="🔥">
          <CalorieCalc />
        </CalcSection>
        <CalcSection title="VO₂ Max Estimator" icon="❤️">
          <VO2Calc />
        </CalcSection>
      </div>
    </div>
  )
}

// ── Main export ──────────────────────────────────────────────────────
export default function HealthSidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* ── Desktop: fixed panel on the right ── */}
      <div className="hidden lg:block">
        {/* Slide-in panel */}
        <div
          className={`fixed top-0 right-0 h-full w-72 bg-white border-l border-[#e0e0e0] z-40 transition-transform duration-300 ease-in-out ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Close button */}
          <button
            onClick={() => setOpen(false)}
            aria-label="Close health tools"
            className="absolute top-4 right-4 text-[#8e8e8e] hover:text-[#181818] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
          <SidebarContent />
        </div>

        {/* Tab trigger on the right edge */}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle health tools"
          className={`fixed top-1/2 -translate-y-1/2 z-50 transition-all duration-300 ease-in-out ${
            open ? 'right-72' : 'right-0'
          }`}
        >
          <div className="bg-[#181818] hover:bg-[#bbf451] hover:text-[#181818] text-white flex items-center justify-center rounded-l-lg w-8 py-6 transition-colors shadow-lg">
            <span
              className="text-[11px] font-semibold tracking-widest uppercase whitespace-nowrap"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              Health Tools
            </span>
          </div>
        </button>
      </div>

      {/* ── Mobile: floating button + bottom drawer ── */}
      <div className="lg:hidden">
        {/* Floating button */}
        {!open && (
          <button
            onClick={() => setOpen(true)}
            aria-label="Open health tools"
            className="fixed bottom-5 right-5 z-50 w-14 h-14 bg-[#181818] hover:bg-[#333] text-white rounded-full flex items-center justify-center shadow-xl transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
            </svg>
          </button>
        )}

        {/* Backdrop */}
        {open && (
          <div
            className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
        )}

        {/* Drawer from bottom */}
        <div
          className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-in-out ${
            open ? 'translate-y-0' : 'translate-y-full'
          }`}
          style={{ maxHeight: '85vh' }}
        >
          {/* Drag handle + close */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="w-10 h-1 bg-[#e0e0e0] rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
            <div />
            <button
              onClick={() => setOpen(false)}
              className="text-[#8e8e8e] hover:text-[#181818] transition-colors ml-auto"
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
