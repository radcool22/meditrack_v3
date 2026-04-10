import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { sendMessage, getHistory, sendCombinedMessage } from '../controllers/chatController.js'

const router = Router()
router.use(requireAuth)

router.post('/combined', sendCombinedMessage)
router.post('/:reportId', sendMessage)
router.get('/:reportId/history', getHistory)

export default router
