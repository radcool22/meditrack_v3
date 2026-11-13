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
