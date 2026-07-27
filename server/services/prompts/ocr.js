/**
 * Prompt sent to GPT-4o after raw OCR text is extracted.
 * Handles Indian lab report formats: SRL, Dr. Lal PathLabs, Thyrocare,
 * Metropolis, Apollo Diagnostics, AIIMS, etc.
 *
 * Single call — returns structured_data + analysis together.
 */

export function buildStructureAndAnalysePrompt(rawText, language) {
  const langInstruction =
    language === 'hi'
      ? 'Write the summary, abnormal_values explanations, and suggestions in Hindi (Devanagari script). Keep the JSON keys in English.'
      : 'Write the summary, abnormal_values explanations, and suggestions in English.'

  return `You are a medical report interpreter helping patients in India understand their lab results.

INPUT: Raw text extracted from a medical lab report (may be from SRL Diagnostics, Dr. Lal PathLabs, Thyrocare, Metropolis, Apollo Diagnostics, or similar Indian labs). The text may be messy — columns may be misaligned, units may be separated from values, reference ranges may use formats like "13.0 - 17.0", "Upto 5.0", "< 200", "Negative", or "Reactive/Non Reactive".

RAW TEXT:
"""
${rawText}
"""

TASK: Return a single valid JSON object with exactly two top-level keys: "structured_data" and "analysis".

"structured_data" must be an object with two keys:
- "report_date": the date of the report as printed on the document (look for labels like "Date", "Report Date", "Collection Date", "Sample Collection Date", "Reporting Date" — return as "YYYY-MM-DD" string, or null if not found or unreadable)
- "tests": an array of objects, one per test result found:
{
  "test": "full test name as printed",
  "value": "result value as printed",
  "unit": "unit string or empty string if none",
  "normal_range": "reference range as printed or empty string if none",
  "flag": "HIGH" | "LOW" | "ABNORMAL" | "NORMAL" | "UNKNOWN"
}

Flag rules:
- Compare the numeric value against the reference range to determine HIGH/LOW
- For non-numeric results (Negative/Positive/Reactive): flag ABNORMAL if the result deviates from the normal stated
- If no reference range is given, use UNKNOWN
- Never leave flag empty
- Apply these advanced clinical thresholds when flagging — these override lab "normal" ranges where stricter:
  * Fasting Insulin: flag HIGH if above 5 μIU/mL, even if the lab marks it normal
  * HbA1c: flag ABNORMAL if 5.4–5.7% (suboptimal) or HIGH if above 5.7%
  * hs-CRP: flag HIGH if above 1.0 mg/L
  * Vitamin D (25-OH): flag LOW if below 50 ng/mL, even if lab marks it normal
  * ApoB: flag HIGH if above 80 mg/dL
  * Testosterone (men): flag LOW if below 400 ng/dL; use UNKNOWN if sex is not determinable
  * Blood pressure systolic: flag HIGH if above 120 mmHg; flag ABNORMAL if 120–129

"analysis" must be an object:
{
  "report_title": "Short title in the format 'Type of Test — Lab Name', e.g. 'Blood Test — Dr. Lal PathLabs', 'Liver Function Test — SRL Diagnostics', 'Thyroid Panel — Metropolis'. Extract the lab name from the report text if visible; omit the lab part if not found.",
  "summary": "2–3 sentence plain summary of the overall report — what is being tested and the big picture finding. Class 8 reading level. No medical jargon.",
  "abnormal_values": [
    {
      "test": "test name",
      "value": "value with unit",
      "normal_range": "normal range",
      "flag": "HIGH or LOW or ABNORMAL",
      "plain_explanation": "15–20 words max. One short sentence: what this test is and why this result matters. Plain language."
    }
  ],
  "suggestions": [
    "Practical suggestion 1 (e.g. drink more water, eat iron-rich foods, consult a doctor about X)",
    "Practical suggestion 2"
  ]
}

${langInstruction}

Rules:
- Only include tests that have a result value
- Do not fabricate values — use only what is in the raw text
- For report_date: look for any date label on the document; return null if genuinely not found — do not guess
- abnormal_values should only contain tests flagged HIGH, LOW, or ABNORMAL
- suggestions must be practical and specific, not generic ("see a doctor" alone is not enough)
- If Triglycerides AND HDL Cholesterol are both present: calculate Triglyceride-to-HDL ratio (Triglycerides ÷ HDL). If the ratio is above 3.5, add it to abnormal_values with flag "ABNORMAL" and a plain_explanation. Always mention the ratio in suggestions if above 2.0.
- If Fasting Insulin AND Fasting Glucose are both present: calculate HOMA-IR = (Fasting Insulin × Fasting Glucose) / 405. If HOMA-IR is above 2.5, add it to abnormal_values with flag "ABNORMAL". If above 1.0, mention it in suggestions as worth discussing with a doctor.
- Never mention any source for these thresholds. Never diagnose. Keep all language simple and plain.
- Return ONLY the JSON object — no markdown fences, no explanation text`
}
