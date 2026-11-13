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
