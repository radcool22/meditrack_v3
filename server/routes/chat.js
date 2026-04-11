import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { sendMessage, getHistory, sendCombinedMessage, sendReportChatMessage, getReportChatHistory } from '../controllers/chatController.js'

const router = Router()
router.use(requireAuth)

router.post('/combined', sendCombinedMessage)
// Report-page restricted chat (must be before /:reportId to avoid param conflict)
router.post('/:reportId/report-chat', sendReportChatMessage)
router.get('/:reportId/report-chat/history', getReportChatHistory)
// Main chat
router.post('/:reportId', sendMessage)
router.get('/:reportId/history', getHistory)

export default router
