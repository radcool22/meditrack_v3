import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { runAnalysis, getAnalysis } from '../controllers/analysisController.js'

const router = Router()
router.use(requireAuth)

router.post('/:reportId', runAnalysis)
router.get('/:reportId', getAnalysis)

// POST /api/analysis/:reportId/chat — Step 6
router.post('/:reportId/chat', (req, res) => {
  res.status(501).json({ message: 'Not implemented' })
})

export default router
