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
 * Extract raw text from a PDF buffer using pdf-parse.
 * Works well for digitally-generated Indian lab PDFs (SRL, Lal PathLabs).
 */
async function ocrPdf(buffer) {
  const result = await pdfParse(buffer)
  if (!result.text?.trim()) throw new Error('pdf-parse returned no text')
  return result.text
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
