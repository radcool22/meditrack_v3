import axios from './axios'
import { announceVideoStarted } from './videoErrors'

// Starts a video for a report. Resolves { ok: true } once a render is running
// (including one that already was), or { ok: false, code } with the server's
// error code for videoErrorMessage().
export async function requestVideo(reportId, ageYears, token) {
  try {
    await axios.post(
      `/api/reports/${reportId}/generate-video`,
      { ageYears },
      { headers: { Authorization: `Bearer ${token}` } },
    )
  } catch (err) {
    const code = err.response?.data?.error
    if (code !== 'already_generating') return { ok: false, code }
  }
  announceVideoStarted(reportId)
  return { ok: true }
}
