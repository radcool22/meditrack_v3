import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import upload from '../middleware/upload.js'
import { uploadReport, getReports, getReport, deleteReport } from '../controllers/reportsController.js'
import { generateVideo, getVideoStatus, cancelVideo } from '../controllers/videoController.js'

const router = Router()
router.use(requireAuth)

router.post('/upload', upload.single('report'), uploadReport)
router.get('/', getReports)
router.get('/:id', getReport)
router.delete('/:id', deleteReport)
router.post('/:id/generate-video', generateVideo)
router.get('/:id/video-status', getVideoStatus)
router.delete('/:id/video', cancelVideo)

export default router
