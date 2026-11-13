import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateOtp, isValidPhone } from '../utils/otp.js'

test('generateOtp returns a 6-digit code', () => {
  for (let i = 0; i < 500; i++) assert.match(generateOtp(), /^\d{6}$/)
})

test('generateOtp never starts with 0', () => {
  for (let i = 0; i < 500; i++) assert.notEqual(generateOtp()[0], '0')
})

test('isValidPhone accepts Indian mobile numbers', () => {
  assert.equal(isValidPhone('+919876543210'), true)
  assert.equal(isValidPhone('+916000000000'), true)
})

test('isValidPhone rejects Indian numbers that are not mobiles or the wrong length', () => {
  assert.equal(isValidPhone('+915876543210'), false) // landline-style first digit
  assert.equal(isValidPhone('+91987654321'), false)  // 9 digits
  assert.equal(isValidPhone('+9198765432100'), false) // 11 digits
  assert.equal(isValidPhone('9876543210'), false)     // no country code
})

test('isValidPhone accepts US numbers', () => {
  assert.equal(isValidPhone('+14155550100'), true)
  assert.equal(isValidPhone('+1415555010'), false)
})

test('isValidPhone rejects junk', () => {
  for (const v of ['', '+91 98765 43210', 'abc', '+449876543210']) assert.equal(isValidPhone(v), false)
})
