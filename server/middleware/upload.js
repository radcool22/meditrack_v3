import multer from 'multer'

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'application/pdf']

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only PDF, JPG, and PNG files are allowed'))
    }
  },
})

export default upload
