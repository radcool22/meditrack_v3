import { useState } from 'react'

const TEST_TEXT =
  'Hello, your blood test results look mostly normal. Your haemoglobin is slightly low.'

export default function ElevenLabsTest() {
  const [status, setStatus] = useState('idle')

  async function handlePlay() {
    setStatus('requesting…')
    console.log('[TEST] ── Step 1: button clicked, sending request to /api/test-voice')

    let res
    try {
      res = await fetch('/api/test-voice', { method: 'POST' })
      console.log('[TEST] ── Step 2: response received')
      console.log('[TEST]    status:', res.status, res.statusText)
      console.log('[TEST]    content-type:', res.headers.get('content-type'))
    } catch (err) {
      console.error('[TEST] ── Step 2 FAILED: network error:', err)
      setStatus('error: network — ' + err.message)
      return
    }

    if (!res.ok) {
      const text = await res.text()
      console.error('[TEST] ── Step 2 FAILED: HTTP', res.status, text)
      setStatus(`error: HTTP ${res.status}`)
      return
    }

    setStatus('decoding audio…')
    let blob
    try {
      blob = await res.blob()
      console.log('[TEST] ── Step 3: blob created')
      console.log('[TEST]    size:', blob.size, 'bytes')
      console.log('[TEST]    type:', blob.type)
    } catch (err) {
      console.error('[TEST] ── Step 3 FAILED: blob error:', err)
      setStatus('error: blob — ' + err.message)
      return
    }

    if (blob.size === 0) {
      console.error('[TEST] ── Step 3 FAILED: blob is empty (0 bytes)')
      setStatus('error: empty audio response')
      return
    }

    const url = URL.createObjectURL(blob)
    console.log('[TEST] ── Step 4: blob URL created:', url)

    const audio = new Audio(url)

    audio.onloadedmetadata = () =>
      console.log('[TEST]    audio metadata loaded, duration:', audio.duration?.toFixed(2), 's')
    audio.oncanplaythrough = () =>
      console.log('[TEST]    audio can play through')
    audio.onplay = () => {
      console.log('[TEST] ── Step 5: audio.play() started')
      setStatus('playing…')
    }
    audio.onended = () => {
      console.log('[TEST] ── Step 6: audio ended ✓')
      URL.revokeObjectURL(url)
      setStatus('done ✓')
    }
    audio.onerror = (e) => {
      console.error('[TEST] ── Step 5 FAILED: audio element error', e, audio.error)
      URL.revokeObjectURL(url)
      setStatus('error: audio element — code ' + (audio.error?.code ?? '?'))
    }

    setStatus('playing…')
    console.log('[TEST] ── Step 5: calling audio.play()…')
    try {
      await audio.play()
      console.log('[TEST]    audio.play() promise resolved')
    } catch (err) {
      console.error('[TEST] ── Step 5 FAILED: audio.play() rejected:', err)
      URL.revokeObjectURL(url)
      setStatus('error: play() blocked — ' + err.message)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col items-center justify-center gap-6 font-sans">
      <button
        onClick={handlePlay}
        disabled={status === 'playing…' || status === 'requesting…' || status === 'decoding audio…'}
        className="bg-[#181818] hover:bg-[#333] disabled:opacity-50 text-white text-sm font-medium px-8 py-4 rounded-xl transition-colors"
      >
        Play Test Audio
      </button>
      <p className="text-xs text-[#8e8e8e] font-mono">{status}</p>
    </div>
  )
}
