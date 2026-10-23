// Video error codes (from POST /generate-video or the render callback) → what the user reads.
const MESSAGES = {
  specialist_required: 'This report is for someone under 18 or is a pregnancy report. Please discuss it with a specialist doctor — we don\'t make videos for these reports.',
  no_numeric_values:   'This report has no number values to explain in a video. You can still ask about it in the chat.',
  already_generating:  'A video for this report is already being made.',
  not_ready:           'This report is still being analysed. Please try again in a moment.',
  rate_limited:        'Our video service is busy right now. Please try again in a minute.',
  invalid_age:         'Please enter a valid age.',
  timeout:             'This is taking longer than expected. Please try again.',
}

const FALLBACK = 'Sorry, we couldn\'t make the video this time. Please try again.'

export function videoErrorMessage(code) {
  return MESSAGES[code] ?? FALLBACK
}

// Fired after a render is scheduled, so the floating progress card appears
// at once instead of polling the reports list to discover it.
export const VIDEO_STARTED_EVENT = 'mt:video-started'

export function announceVideoStarted(reportId) {
  window.dispatchEvent(new CustomEvent(VIDEO_STARTED_EVENT, { detail: { reportId } }))
}
