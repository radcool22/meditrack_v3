import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseValue, parseNormalRange, buildRenderPayload } from '../services/renderPayloadMapper.js'

test('parseValue reads plain and decimal numbers', () => {
  assert.equal(parseValue('142'), 142)
  assert.equal(parseValue('5.7'), 5.7)
  assert.equal(parseValue(98), 98)
  assert.equal(parseValue('-2.5'), -2.5)
})

test('parseValue handles Indian digit grouping and trailing units', () => {
  assert.equal(parseValue('1,50,000'), 150000)
  assert.equal(parseValue('142 mg/dL'), 142)
  assert.equal(parseValue('  13.5 g/dL '), 13.5)
})

test('parseValue returns NaN for text and qualified results', () => {
  for (const v of ['Negative', 'Reactive', '<5.0', '>100', '', null, undefined]) assert.ok(Number.isNaN(parseValue(v)), String(v))
})

test('parseNormalRange reads low–high ranges', () => {
  assert.deepEqual(parseNormalRange('13.0 - 17.0'), { low: 13, high: 17 })
  assert.deepEqual(parseNormalRange('70 to 100 mg/dL'), { low: 70, high: 100 })
  assert.deepEqual(parseNormalRange('1,50,000 – 4,10,000'), { low: 150000, high: 410000 })
})

test('parseNormalRange reads one-sided ranges', () => {
  assert.deepEqual(parseNormalRange('< 200'), { low: null, high: 200 })
  assert.deepEqual(parseNormalRange('≤ 5.7'), { low: null, high: 5.7 })
  assert.deepEqual(parseNormalRange('Upto 5.0'), { low: null, high: 5 })
  assert.deepEqual(parseNormalRange('> 40'), { low: 40, high: null })
  assert.deepEqual(parseNormalRange('more than 40'), { low: 40, high: null })
})

test('parseNormalRange: text-only ranges are null, unknown shapes are open', () => {
  assert.equal(parseNormalRange('Negative'), null)
  assert.equal(parseNormalRange('Reactive/Non-Reactive'), null)
  assert.deepEqual(parseNormalRange('Male: 13-17'), { low: null, high: null })
  assert.deepEqual(parseNormalRange(''), { low: null, high: null })
  assert.deepEqual(parseNormalRange(undefined), { low: null, high: null })
})

const report = { id: 'r1', report_title: 'Complete Blood Count — Dr Lal PathLabs', report_date: '2026-10-01' }
const finding = (test, value, unit, normal_range = '', flag = 'NORMAL') => ({ test, value, unit, normal_range, flag })
const statusOf = (...args) => buildRenderPayload({ report, structuredData: [finding(...args)], user: null, ageYears: 40 }).findings[0].status

test('buildRenderPayload splits the report title into type and lab', () => {
  const p = buildRenderPayload({ report, structuredData: [], user: null, ageYears: 40 })
  assert.equal(p.report.type, 'Complete Blood Count')
  assert.equal(p.report.lab, 'Dr Lal PathLabs')
  assert.equal(p.report.date, '2026-10-01')
})

test('buildRenderPayload leaves missing details empty instead of inventing them', () => {
  const p = buildRenderPayload({ report: { id: 'r2' }, structuredData: null, user: { name: '  ' }, ageYears: '52' })
  assert.equal(p.report.type, 'Medical Report')
  assert.equal(p.report.lab, '')
  assert.equal(p.report.date, '')
  assert.equal(p.patient.firstName, '')
  assert.equal(p.patient.ageYears, 52)
  assert.deepEqual(p.findings, [])
})

test('buildRenderPayload uses only the first name', () => {
  const p = buildRenderPayload({ report, structuredData: [], user: { name: ' Asha  Rani Verma ' }, ageYears: 60 })
  assert.equal(p.patient.firstName, 'Asha')
})

test('buildRenderPayload flags pregnancy panels from the title or test names', () => {
  const byTitle = buildRenderPayload({ report: { id: 'a', report_title: 'Antenatal Profile' }, structuredData: [], user: null, ageYears: 28 })
  const byTest  = buildRenderPayload({ report: { id: 'b', report_title: 'Blood test' }, structuredData: [finding('Beta HCG', '1200', 'mIU/mL')], user: null, ageYears: 28 })
  const neither = buildRenderPayload({ report, structuredData: [finding('Haemoglobin', '13', 'g/dL')], user: null, ageYears: 28 })
  assert.equal(byTitle.patient.isPregnancyPanel, true)
  assert.equal(byTest.patient.isPregnancyPanel, true)
  assert.equal(neither.patient.isPregnancyPanel, false)
})

test('buildRenderPayload skips findings that cannot be drawn on a scale', () => {
  const p = buildRenderPayload({
    report,
    structuredData: [
      finding('HIV', 'Non Reactive', '', 'Non Reactive'),
      finding('Urine sugar', 'Nil', '', 'Negative'),
      finding('Glucose', '95', 'mg/dL', 'Negative'),
      finding('Haemoglobin', '13.5', 'g/dL', '13 - 17'),
    ],
    user: null,
    ageYears: 40,
  })
  assert.deepEqual(p.findings.map((f) => f.valueName), ['Haemoglobin'])
  assert.deepEqual(p.findings[0].referenceRange, { low: 13, high: 17 })
})

test('lab flags map to high / low / normal', () => {
  assert.equal(statusOf('Vitamin D', '12', 'ng/mL', '30 - 100', 'LOW'), 'low')
  assert.equal(statusOf('LDL', '180', 'mg/dL', '< 100', 'HIGH'), 'high')
  assert.equal(statusOf('ESR', '40', 'mm/hr', '0 - 20', 'ABNORMAL'), 'high')
  assert.equal(statusOf('TSH', '2.1', 'uIU/mL', '0.4 - 4.0', 'UNKNOWN'), 'normal')
  assert.equal(statusOf('TSH', '2.1', 'uIU/mL', '0.4 - 4.0', undefined), 'normal')
})

test('dangerously high or low blood sugar is critical', () => {
  assert.equal(statusOf('Glucose Fasting', '450', 'mg/dL', '70 - 100', 'HIGH'), 'critical_high')
  assert.equal(statusOf('Blood Sugar Random', '42', 'mg/dL', '70 - 140', 'LOW'), 'critical_low')
  assert.equal(statusOf('Glucose Fasting', '180', 'mg/dL', '70 - 100', 'HIGH'), 'high')
})

test('critical checks need the expected unit and skip urine tests', () => {
  assert.equal(statusOf('Glucose Fasting', '25', 'mmol/L', '3.9 - 5.5', 'HIGH'), 'high')
  assert.equal(statusOf('Urine Glucose', '500', 'mg/dL', '0 - 15', 'HIGH'), 'high')
})

test('haemoglobin is critical below 7 g/dL, but HbA1c is never treated as haemoglobin', () => {
  assert.equal(statusOf('Haemoglobin', '6.2', 'g/dL', '12 - 15', 'LOW'), 'critical_low')
  assert.equal(statusOf('Hemoglobin (Hb)', '9.5', 'g/dL', '12 - 15', 'LOW'), 'low')
  assert.equal(statusOf('Glycated Haemoglobin (HbA1c)', '25', 'g/dL', '< 5.7', 'HIGH'), 'high')
  assert.equal(statusOf('Mean Corpuscular Haemoglobin', '35', 'g/dL', '27 - 32', 'HIGH'), 'high')
})

test('platelet counts are critical in every way Indian labs print them', () => {
  assert.equal(statusOf('Platelet Count', '15,000', '/cumm', '1,50,000 - 4,10,000', 'LOW'), 'critical_low')
  assert.equal(statusOf('Platelet Count', '15', 'x10^3/uL', '150 - 410', 'LOW'), 'critical_low')
  assert.equal(statusOf('Platelet Count', '0.15', 'lakhs/cumm', '1.5 - 4.1', 'LOW'), 'critical_low')
  assert.equal(statusOf('Platelet Count', '2.5', 'lakhs/cumm', '1.5 - 4.1', 'NORMAL'), 'normal')
  assert.equal(statusOf('Mean Platelet Volume', '15', 'fL', '7 - 11', 'HIGH'), 'high')
})
