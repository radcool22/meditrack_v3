import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { sendOtp, verifyOtp, updateProfile } from '../controllers/authController.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.body.phone_number || req.ip,
  message: { error: 'Too many OTP requests. Try again in 10 minutes.' },
})

router.post('/send-otp', otpLimiter, sendOtp)
router.post('/verify-otp', verifyOtp)
router.patch('/profile', requireAuth, updateProfile)

export default router
