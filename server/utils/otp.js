import { randomInt } from 'crypto'

export function generateOtp() {
  return String(randomInt(100000, 999999))
}

export function isValidIndianPhone(phone) {
  if (process.env.NODE_ENV !== 'production' && phone === '+910000000000') return true
  return /^\+91[6-9]\d{9}$/.test(phone)
}
