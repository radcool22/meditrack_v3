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
