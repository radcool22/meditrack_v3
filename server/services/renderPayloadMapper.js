const PREGNANCY_KEYWORDS = /pregnancy|hcg|prenatal|obstetric|antenatal/i

const FLAG_MAP = {
  HIGH:     'high',
  LOW:      'low',
  NORMAL:   'normal',
  ABNORMAL: 'high',
  UNKNOWN:  'normal',
}

// Critical (panic) values — the render service opens the video with
// "see a doctor today" for these (CLAUDE.md §2.1.7). Deliberately limited to
// tests whose units are unambiguous, and checked against the unit so a value
// in different units can never trip it. Thresholds follow common hospital
// critical-value lists; have a clinician review before changing them.
const CRITICAL_LIMITS = [
  { name: /glucose|blood sugar/i, exclude: /urine/i, unit: /mg\s*\/\s*dl/i, low: 50, high: 400 },
  { name: /ha?emoglobin|\bhb\b|\bhgb\b/i, exclude: /glyc|a1c|corpuscular|mch|mean|urine/i, unit: /g\s*\/\s*dl/i, low: 7, high: 20 },
  { name: /potassium/i, exclude: /urine/i, unit: /mmol|meq/i, low: 2.8, high: 6.2 },
  { name: /sodium/i, exclude: /urine/i, unit: /mmol|meq/i, low: 120, high: 160 },
  { name: /calcium/i, exclude: /ioni[sz]ed|urine/i, unit: /mg\s*\/\s*dl/i, low: 6.5, high: 13 },
  // Platelets are printed as an absolute count (1,50,000 /cumm), in
  // thousands (150 x10^3/µL) or in lakhs (1.5 lakhs/cumm); compared in thousands.
  { name: /platelet/i, exclude: /volume|mpv|pdw/i, unit: /./, low: 20, high: 1000, inThousands: true },
]

function criticalStatus(name, value, unit) {
  const rule = CRITICAL_LIMITS.find((r) => r.name.test(name) && !r.exclude.test(name))
  if (!rule || !rule.unit.test(unit || '')) return null
  let v = value
  if (rule.inThousands) {
    if (/lakh/i.test(unit)) v = value * 100
    else if (value >= 5000) v = value / 1000
  }
  if (v < rule.low) return 'critical_low'
  if (v > rule.high) return 'critical_high'
  return null
}

// Indian labs group digits as 1,50,000 — drop separators between digits.
function stripDigitGrouping(s) {
  return s.replace(/(\d),(?=\d)/g, '$1')
}

/**
 * Parses a printed result into a number. Returns NaN for anything that is not
 * an exact value: text results ("Negative"), qualified values ("<5.0").
 * A trailing unit ("142 mg/dL") is fine.
 */
export function parseValue(raw) {
  if (raw === null || raw === undefined) return NaN
  const s = stripDigitGrouping(String(raw).trim())
  if (!/^-?\d/.test(s)) return NaN
  return parseFloat(s)
}

/**
 * Parses a free-form reference range string from Indian lab reports.
 *
 * Returns { low: number|null, high: number|null } for parseable numeric ranges.
 * Returns null for clearly non-numeric ranges (e.g. "Negative", "Reactive/Non-Reactive") —
 * callers should skip the finding entirely when null is returned.
 * Trailing units ("70 - 100 mg/dL") are ignored.
 */
export function parseNormalRange(str) {
  if (!str || typeof str !== 'string') return { low: null, high: null }

  const s = stripDigitGrouping(str.trim())
  if (s === '') return { low: null, high: null }

  // If the string contains no digits it's a text-only range — skip the finding
  if (!/\d/.test(s)) return null

  // "13.0 - 17.0", "0 - 5.0", "70 to 100 mg/dL"
  const rangeMatch = s.match(/^(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)/i)
  if (rangeMatch) {
    return { low: parseFloat(rangeMatch[1]), high: parseFloat(rangeMatch[2]) }
  }

  // "< 200", "<=5.7", "≤ 5.7", "Upto 5.0", "less than 200"
  const ltMatch = s.match(/^(?:<=?|≤|up\s*to|less than|below)\s*(\d+(?:\.\d+)?)/i)
  if (ltMatch) return { low: null, high: parseFloat(ltMatch[1]) }

  // "> 40", ">=40", "≥ 40", "more than 40"
  const gtMatch = s.match(/^(?:>=?|≥|more than|greater than|above)\s*(\d+(?:\.\d+)?)/i)
  if (gtMatch) return { low: parseFloat(gtMatch[1]), high: null }

  // Anything else that has digits but no recognisable pattern (e.g. "Male: 13-17")
  return { low: null, high: null }
}

function mapFlag(flag) {
  return FLAG_MAP[flag?.toUpperCase()] ?? 'normal'
}

/**
 * Builds the full payload shape expected by POST /render on the render service.
 * Missing name/lab/date are sent as "" — the script prompt then leaves them
 * out rather than inventing them (no "Patient जी", no "Unknown Lab", no
 * today's date passed off as the report date).
 *
 * @param {object} report       - Row from the reports table (must include id, report_title, report_date)
 * @param {Array}  structuredData - Contents of reports.structured_data (tests array)
 * @param {object} user         - Row from the users table (name may be null)
 * @param {number} ageYears     - Age collected from the user at generation time (not stored)
 */
export function buildRenderPayload({ report, structuredData, user, ageYears }) {
  // patient.firstName — first word of name, or empty
  const firstName = user?.name?.trim() ? user.name.trim().split(/\s+/)[0] : ''

  // report.type and report.lab — split report_title on " — "
  const titleParts = (report.report_title ?? '').split(' — ')
  const reportType = titleParts[0]?.trim() || 'Medical Report'
  const lab        = titleParts[1]?.trim() || ''

  const tests = Array.isArray(structuredData) ? structuredData : []

  // patient.isPregnancyPanel — heuristic from title + test names
  const testNames = tests.map((t) => t.test ?? '').join(' ')
  const isPregnancyPanel =
    PREGNANCY_KEYWORDS.test(report.report_title ?? '') ||
    PREGNANCY_KEYWORDS.test(testNames)

  // findings — filter out non-numeric values and non-numeric reference ranges
  const findings = []
  for (const item of tests) {
    const numValue = parseValue(item.value)
    if (isNaN(numValue)) continue

    const refRange = parseNormalRange(item.normal_range ?? '')
    if (refRange === null) continue

    const valueName = item.test ?? ''
    const unit      = item.unit ?? ''
    findings.push({
      valueName,
      value:          numValue,
      unit,
      referenceRange: refRange,
      status:         criticalStatus(valueName, numValue, unit) ?? mapFlag(item.flag),
      history:        null,
    })
  }

  return {
    reportId:    report.id,
    callbackUrl: `${process.env.APP_BASE_URL}/api/videos/callback`,
    patient: {
      firstName,
      ageYears:         parseInt(ageYears, 10),
      isPregnancyPanel,
    },
    report: {
      type: reportType,
      date: report.report_date ?? '',
      lab,
    },
    findings,
    lang: 'hi',
  }
}
