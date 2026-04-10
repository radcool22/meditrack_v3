import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import upload from '../middleware/upload.js'
import { uploadReport, getReports, getReport, deleteReport } from '../controllers/reportsController.js'

const router = Router()
router.use(requireAuth)

router.post('/upload', upload.single('report'), uploadReport)
router.get('/', getReports)
router.get('/:id', getReport)
router.delete('/:id', deleteReport)

export default router
