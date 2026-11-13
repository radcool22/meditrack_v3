import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateOtp, isValidPhone } from '../utils/otp.js'

test('generateOtp returns a 6-digit code', () => {
  for (let i = 0; i < 500; i++) assert.match(generateOtp(), /^\d{6}$/)
})

test('generateOtp never starts with 0', () => {
  for (let i = 0; i < 500; i++) assert.notEqual(generateOtp()[0], '0')
})
