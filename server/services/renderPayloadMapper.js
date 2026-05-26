import crypto from 'crypto'

const PREGNANCY_KEYWORDS = /pregnancy|hcg|prenatal|obstetric|antenatal/i

const FLAG_MAP = {
  HIGH:     'high',
  LOW:      'low',
  NORMAL:   'normal',
  ABNORMAL: 'high',
  UNKNOWN:  'normal',
}

/**
 * Parses a free-form reference range string from Indian lab reports.
 *
 * Returns { low: number|null, high: number|null } for parseable numeric ranges.
 * Returns null for clearly non-numeric ranges (e.g. "Negative", "Reactive/Non-Reactive") —
 * callers should skip the finding entirely when null is returned.
 */
export function parseNormalRange(str) {
  if (!str || typeof str !== 'string') return { low: null, high: null }

  const s = str.trim()
  if (s === '') return { low: null, high: null }

  // If the string contains no digits it's a text-only range — skip the finding
  if (!/\d/.test(s)) return null

  // "13.0 - 17.0" or "0 - 5.0"
  const rangeMatch = s.match(/^([\d.]+)\s*[-–]\s*([\d.]+)$/)
  if (rangeMatch) {
    return { low: parseFloat(rangeMatch[1]), high: parseFloat(rangeMatch[2]) }
  }

  // "< 200" or "<200"
  const ltMatch = s.match(/^<\s*([\d.]+)$/)
  if (ltMatch) return { low: null, high: parseFloat(ltMatch[1]) }

  // "> 40" or ">40"
  const gtMatch = s.match(/^>\s*([\d.]+)$/)
  if (gtMatch) return { low: parseFloat(gtMatch[1]), high: null }

  // "Upto 5.0" or "upto 5.0"
  const uptoMatch = s.match(/^(?:upto|up to)\s*([\d.]+)$/i)
  if (uptoMatch) return { low: null, high: parseFloat(uptoMatch[1]) }

  // Anything else that has digits but no recognisable pattern
  return { low: null, high: null }
}

function mapFlag(flag) {
  return FLAG_MAP[flag?.toUpperCase()] ?? 'normal'
}

/**
 * Builds the full payload shape expected by POST /render on the render service.
 *
 * @param {object} report       - Row from the reports table (must include id, report_title, report_date)
 * @param {Array}  structuredData - Contents of reports.structured_data (tests array)
 * @param {object} user         - Row from the users table (name may be null)
 * @param {number} ageYears     - Age collected from the user at generation time (not stored)
 */
export function buildRenderPayload({ report, structuredData, user, ageYears }) {
  // patient.firstName — first word of name, or fallback
  const firstName = user?.name ? user.name.split(' ')[0] : 'Patient'

  // report.type and report.lab — split report_title on " — "
  const titleParts = (report.report_title ?? '').split(' — ')
  const reportType = titleParts[0]?.trim() || 'Medical Report'
  const lab        = titleParts[1]?.trim() || 'Unknown Lab'

  // patient.isPregnancyPanel — heuristic from title + test names
  const testNames = Array.isArray(structuredData)
    ? structuredData.map((t) => t.test ?? '').join(' ')
    : ''
  const isPregnancyPanel =
    PREGNANCY_KEYWORDS.test(report.report_title ?? '') ||
    PREGNANCY_KEYWORDS.test(testNames)

  // findings — filter out non-numeric values and non-numeric reference ranges
  const findings = []
  for (const item of (Array.isArray(structuredData) ? structuredData : [])) {
    const numValue = parseFloat(item.value)
    if (isNaN(numValue)) continue

    const refRange = parseNormalRange(item.normal_range ?? '')
    if (refRange === null) continue

    findings.push({
      valueName:      item.test ?? '',
      value:          numValue,
      unit:           item.unit ?? '',
      referenceRange: refRange,
      status:         mapFlag(item.flag),
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
      date: report.report_date ?? new Date().toISOString().split('T')[0],
      lab,
    },
    findings,
    lang: 'hi',
  }
}
