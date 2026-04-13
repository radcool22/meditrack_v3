/**
 * Wraps any issue description into the standard user-friendly error format.
 * Usage: friendly('your message not being sent')
 */
export function friendly(issue) {
  return `Sorry, there was a small issue. The issue is related to ${issue}. Please try again or contact us.`
}
