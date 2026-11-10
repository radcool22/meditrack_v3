import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { startCall, getCalls, getOneCall, callContext, callWebhook } from '../controllers/voiceController.js'

const router = Router()

router.post('/call', requireAuth, startCall)
router.get('/calls', requireAuth, getCalls)
router.get('/calls/:id', requireAuth, getOneCall)

// No requireAuth — called by Sarvam, each with its own secret
router.post('/context', callContext)
router.post('/webhook', callWebhook)

export default router
