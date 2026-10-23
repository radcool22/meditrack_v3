import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { sendOtp, verifyOtp, updateProfile } from '../controllers/authController.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// Per number: 3 SMS per 10 min. Rejected requests (wrong login/signup mode,
// invalid number) don't count — only an SMS actually sent does.
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.body.phone_number || req.ip,
  skipFailedRequests: true,
  message: { error: 'Too many OTP requests. Try again in 10 minutes.' },
})

// Per IP: stops one client cycling through many numbers (SMS pumping / Twilio bill).
const otpIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many OTP requests. Try again later.' },
})

// Per number: 5 wrong codes per 10 min — a 6-digit code can't be brute-forced.
const verifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.body.phone_number || req.ip,
  skipSuccessfulRequests: true,
  message: { error: 'Too many wrong codes. Request a new OTP in 10 minutes.' },
})

router.post('/send-otp', otpIpLimiter, otpLimiter, sendOtp)
router.post('/verify-otp', verifyLimiter, verifyOtp)
router.patch('/profile', requireAuth, updateProfile)

export default router
