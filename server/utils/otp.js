import { randomInt } from 'crypto'

export function generateOtp() {
  return String(randomInt(100000, 999999))
}

export function isValidPhone(phone) {
  if (process.env.NODE_ENV !== 'production' && phone === '+910000000000') return true
  // India: +91 followed by 10 digits starting 6-9
  if (/^\+91[6-9]\d{9}$/.test(phone)) return true
  // USA: +1 followed by 10 digits
  if (/^\+1\d{10}$/.test(phone)) return true
  return false
}

/** @deprecated use isValidPhone */
export const isValidIndianPhone = isValidPhone
