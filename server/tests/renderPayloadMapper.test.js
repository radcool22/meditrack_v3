import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseValue, parseNormalRange, buildRenderPayload } from '../services/renderPayloadMapper.js'

test('parseValue reads plain and decimal numbers', () => {
  assert.equal(parseValue('142'), 142)
  assert.equal(parseValue('5.7'), 5.7)
  assert.equal(parseValue(98), 98)
  assert.equal(parseValue('-2.5'), -2.5)
})
