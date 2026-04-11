import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { runAnalysis, getAnalysis } from '../controllers/analysisController.js'

const router = Router()
router.use(requireAuth)

router.post('/:reportId', runAnalysis)
router.get('/:reportId', getAnalysis)

export default router
