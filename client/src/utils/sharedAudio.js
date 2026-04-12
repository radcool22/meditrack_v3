/**
 * Module-level AudioContext singleton.
 * Must be created/resumed inside a user-gesture handler (click, tap).
 * Call unlockAudio() in any click handler that will lead to audio playback.
 * useVoice picks it up via getAudioContext().
 */

let ctx = null

export function unlockAudio() {
  if (typeof window === 'undefined') return
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return
  if (!ctx || ctx.state === 'closed') {
    ctx = new AC()
  } else if (ctx.state === 'suspended') {
    ctx.resume()
  }
}

export function getAudioContext() {
  return ctx
}
