import { Router } from 'express'
import { handleVideoCallback } from '../controllers/videoController.js'

const router = Router()

// No requireAuth — this route is called by the render service, not the end user
router.post('/callback', handleVideoCallback)

export default router
