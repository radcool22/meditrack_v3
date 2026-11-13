import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as server from '../config/languages.js'
import * as client from '../../client/src/config/languages.js'

// Regexes don't compare with deepEqual; compare their source instead.
const plain = (langs) => JSON.parse(JSON.stringify(langs, (_, v) => (v instanceof RegExp ? v.source : v)))

test('server and client language lists are identical', () => {
  assert.deepEqual(plain(server.getAllLanguages()), plain(client.getAllLanguages()))
})

test('unknown languages fall back to English, never Hindi', () => {
  assert.equal(server.getLanguage('xx').code, 'en')
  assert.equal(server.getLanguage(undefined).code, 'en')
  assert.equal(server.isSupported('hi'), true)
  assert.equal(server.isSupported('toString'), false)
})
