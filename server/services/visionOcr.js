import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')

const VISION_URL = `https://vision.googleapis.com/v1/images:annotate`

/**
 * Extract raw text from an image (JPG/PNG) using Google Vision
 * DOCUMENT_TEXT_DETECTION — better than TEXT_DETECTION for dense
 * tabular content like Indian lab reports.
 */
async function ocrImage(buffer) {
  const base64 = buffer.toString('base64')
  const body = {
    requests: [
      {
        image: { content: base64 },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        imageContext: {
          languageHints: ['en', 'hi'], // handles bilingual Indian reports
        },
      },
    ],
  }

  const res = await fetch(
    `${VISION_URL}?key=${process.env.GOOGLE_CLOUD_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Vision API error ${res.status}: ${err}`)
  }

  const json = await res.json()

  // Vision returns HTTP 200 but may embed a per-image error in the response body
  const responseError = json.responses?.[0]?.error
  if (responseError) {
    throw new Error(`Vision API image error (${responseError.code}): ${responseError.message}`)
  }

  const text = json.responses?.[0]?.fullTextAnnotation?.text
  if (!text) throw new Error('Vision API returned no text — image may be blurry, low resolution, or not a text document')
  return text
}

/**
 * OCR a scanned (image-only) PDF with Vision's file API. Inline content
 * covers the first 5 pages — enough for a lab report.
 */
async function ocrScannedPdf(buffer) {
  const res = await fetch(
    `https://vision.googleapis.com/v1/files:annotate?key=${process.env.GOOGLE_CLOUD_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          inputConfig: { content: buffer.toString('base64'), mimeType: 'application/pdf' },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          imageContext: { languageHints: ['en', 'hi'] },
        }],
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Vision PDF error ${res.status}: ${err}`)
  }

  const json  = await res.json()
  const file  = json.responses?.[0]
  if (file?.error) throw new Error(`Vision PDF error (${file.error.code}): ${file.error.message}`)
  const text = (file?.responses ?? []).map((page) => page.fullTextAnnotation?.text ?? '').join('\n').trim()
  if (!text) throw new Error('Vision found no text in the PDF — it may be blurry or blank')
  return text
}

// Fewer characters than this means the PDF is a scan with no text layer.
const MIN_PDF_TEXT_CHARS = 40

/**
 * Extract raw text from a PDF buffer. Digitally-generated lab PDFs (SRL,
 * Lal PathLabs) have a text layer that pdf-parse reads directly; scanned
 * PDFs (very common — a phone scan saved as PDF) fall back to Vision OCR.
 */
async function ocrPdf(buffer) {
  let text = ''
  try {
    text = (await pdfParse(buffer)).text?.trim() ?? ''
  } catch {
    // Unreadable text layer — Vision can still OCR the pages.
  }
  if (text.length >= MIN_PDF_TEXT_CHARS) return text
  return ocrScannedPdf(buffer)
}

/**
 * Main export — dispatches to the right extractor based on file type.
 * @param {Buffer} buffer  Raw file bytes
 * @param {'jpg'|'png'|'pdf'} fileType
 * @returns {Promise<string>} Raw extracted text
 */
export async function extractText(buffer, fileType) {
  if (fileType === 'pdf') return ocrPdf(buffer)
  return ocrImage(buffer)
}
