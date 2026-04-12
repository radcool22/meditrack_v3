import jwt from 'jsonwebtoken'
import supabase from '../services/supabase.js'
import { sendSms } from '../services/twilio.js'
import { generateOtp, isValidPhone } from '../utils/otp.js'

export async function updateProfile(req, res) {
  const { userId } = req.user
  const { name, language_preference } = req.body

  const updates = {}
  if (name?.trim()) updates.name = name.trim()
  if (language_preference === 'en' || language_preference === 'hi') {
    updates.language_preference = language_preference
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' })
  }

  const { data: user, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('id, phone_number, name, language_preference')
    .single()

  if (error) {
    console.error('Profile update error:', error.message)
    return res.status(500).json({ error: 'Failed to update profile' })
  }

  return res.json({ user })
}

export async function sendOtp(req, res) {
  const { phone_number, mode } = req.body

  if (!phone_number || !isValidPhone(phone_number)) {
    return res.status(400).json({ error: 'Valid phone number required' })
  }

  // Block sign-up if phone is already registered
  console.log('[sendOtp] mode:', mode, 'phone:', phone_number)
  if (mode === 'signup') {
    const { data: existing, error: checkErr } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', phone_number)
      .maybeSingle()
    console.log('[sendOtp] existing user:', existing, 'checkErr:', checkErr?.message)
    if (checkErr) {
      console.error('User check error:', checkErr.message)
      return res.status(500).json({ error: 'Internal error' })
    }
    if (existing) {
      return res.status(409).json({
        error: 'This number is already registered. Please log in instead.',
        hint: 'login',
      })
    }
  }

  // Dev bypass: +910000000000 → no Twilio, no DB insert
  if (process.env.NODE_ENV !== 'production' && phone_number === '+910000000000') {
    return res.json({ message: 'OTP sent' })
  }

  const otp = generateOtp()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { error: dbError } = await supabase
    .from('otp_verifications')
    .insert({ phone_number, otp_code: otp, expires_at: expiresAt })

  if (dbError) {
    console.error('DB insert error:', JSON.stringify(dbError))
    return res.status(500).json({ error: 'Failed to create OTP' })
  }

  try {
    await sendSms(phone_number, `Your MediTrack OTP is ${otp}. Valid for 10 minutes.`)
  } catch (smsError) {
    console.error('SMS error:', smsError.message)
    return res.status(500).json({ error: 'Failed to send OTP' })
  }

  return res.json({ message: 'OTP sent' })
}

export async function verifyOtp(req, res) {
  const { phone_number, otp_code } = req.body

  if (!phone_number || !otp_code) {
    return res.status(400).json({ error: 'phone_number and otp_code are required' })
  }

  // Dev bypass: accept 000000 for the test number without hitting DB or Twilio
  if (process.env.NODE_ENV !== 'production' && phone_number === '+910000000000') {
    if (otp_code !== '000000') {
      return res.status(401).json({ error: 'Invalid or expired OTP' })
    }
    // Fall through to user upsert — skip OTP table entirely
    const now = new Date().toISOString()
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', phone_number)
      .maybeSingle()
    const isNewUser = !existingUser

    const { data: user, error: upsertError } = await supabase
      .from('users')
      .upsert(
        { phone_number, last_login_at: now },
        { onConflict: 'phone_number', ignoreDuplicates: false }
      )
      .select('id, phone_number, name, language_preference')
      .single()

    if (upsertError) {
      console.error('User upsert error:', upsertError.message)
      return res.status(500).json({ error: 'Failed to create/update user' })
    }

    const token = jwt.sign(
      { userId: user.id, phone: user.phone_number },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )
    return res.json({ token, user, isNewUser })
  }

  const now = new Date().toISOString()

  const { data: otpRow, error: fetchError } = await supabase
    .from('otp_verifications')
    .select('id')
    .eq('phone_number', phone_number)
    .eq('otp_code', otp_code)
    .eq('is_used', false)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fetchError) {
    console.error('OTP fetch error:', fetchError.message)
    return res.status(500).json({ error: 'Internal error' })
  }

  if (!otpRow) {
    return res.status(401).json({ error: 'Invalid or expired OTP' })
  }

  const { error: markError } = await supabase
    .from('otp_verifications')
    .update({ is_used: true })
    .eq('id', otpRow.id)

  if (markError) {
    console.error('OTP mark error:', markError.message)
    return res.status(500).json({ error: 'Internal error' })
  }

  // Check if user already exists before upsert so we can detect new sign-ups
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('phone_number', phone_number)
    .maybeSingle()
  const isNewUser = !existingUser

  const { data: user, error: upsertError } = await supabase
    .from('users')
    .upsert(
      { phone_number, last_login_at: now },
      { onConflict: 'phone_number', ignoreDuplicates: false }
    )
    .select('id, phone_number, name, language_preference')
    .single()

  if (upsertError) {
    console.error('User upsert error:', upsertError.message)
    return res.status(500).json({ error: 'Failed to create/update user' })
  }

  const token = jwt.sign(
    { userId: user.id, phone: user.phone_number },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )

  return res.json({ token, user, isNewUser })
}
