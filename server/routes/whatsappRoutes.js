import { Router } from 'express'
import { verifyWebhook, receiveMessage } from '../controllers/whatsappController.js'

const router = Router()

router.get('/webhook', verifyWebhook)
router.post('/webhook', receiveMessage)

export default router
