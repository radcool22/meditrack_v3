import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Voice mode.
 *
 * STT : browser-native SpeechRecognition (continuous mode).
 *       Recording does NOT auto-stop on silence — user must explicitly
 *       call confirmListening() to process or cancelListening() to discard.
 * TTS : ElevenLabs WebSocket streaming via /ws/tts backend proxy.
 *       AudioContext is unlocked on the first user tap (connect()),
 *       so audio.play() is never blocked by the browser's autoplay policy.
 */
export function useVoice() {
  const [voiceState, setVoiceState] = useState('idle')
  const [errorMsg, setErrorMsg]     = useState('')

  const recognitionRef        = useRef(null)
  const ttsWsRef              = useRef(null)
  const audioCtxRef           = useRef(null)
  const sourceNodeRef         = useRef(null)
  const audioRef              = useRef(null)
  const pendingConfirmRef     = useRef(false)
  const transcriptRef         = useRef('')
  const onTranscriptCallbackRef = useRef(null)

  const isSupported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  // ── Connect — unlocks AudioContext on first user tap ─────────────────
  const connect = useCallback(() => {
    setErrorMsg('')
    if (!isSupported) {
      setErrorMsg('Voice input is not supported in this browser. Please use Chrome or Safari.')
      setVoiceState('error')
      return
    }
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      } else if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume()
      }
    } catch (e) {
      console.warn('[TTS] Could not create AudioContext:', e)
    }
    setVoiceState('ready')
  }, [isSupported])

  // ── Start listening (continuous — waits for confirmListening) ─────────
  const startListening = useCallback((onTranscript, lang = 'en-IN') => {
    if (voiceState !== 'ready') return

    transcriptRef.current = ''
    pendingConfirmRef.current = false
    onTranscriptCallbackRef.current = onTranscript

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const r  = new SR()
    r.lang            = lang
    r.continuous      = true
    r.interimResults  = false
    r.maxAlternatives = 1
    recognitionRef.current = r

    r.onstart = () => setVoiceState('listening')

    r.onresult = (e) => {
      // Accumulate all final segments
      let text = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          text += e.results[i][0].transcript + ' '
        }
      }
      transcriptRef.current = text.trim()
    }

    r.onerror = (e) => {
      const msg =
        e.error === 'not-allowed' ? 'Microphone access denied. Please allow microphone in your browser settings.' :
        e.error === 'no-speech'   ? 'No speech detected. Please try again.' :
        e.error === 'network'     ? 'Network error. Please check your connection.' :
        'Could not recognise speech. Please try again.'
      setErrorMsg(msg)
      setVoiceState('ready')
    }

    r.onend = () => {
      if (pendingConfirmRef.current) {
        pendingConfirmRef.current = false
        const text = transcriptRef.current
        if (text) {
          setVoiceState('thinking')
          onTranscriptCallbackRef.current?.(text)
        } else {
          setVoiceState('ready')
        }
      } else {
        // Cancelled or browser auto-ended (long silence on some browsers)
        setVoiceState('ready')
      }
    }

    try { r.start() } catch {
      setErrorMsg('Could not start microphone. Please try again.')
      setVoiceState('ready')
    }
  }, [voiceState])

  // ── Confirm — stop and process the accumulated transcript ─────────────
  const confirmListening = useCallback(() => {
    pendingConfirmRef.current = true
    recognitionRef.current?.stop()
  }, [])

  // ── Cancel — abort without processing ────────────────────────────────
  const cancelListening = useCallback(() => {
    pendingConfirmRef.current = false
    transcriptRef.current = ''
    recognitionRef.current?.abort()
    setVoiceState('ready')
    setErrorMsg('')
  }, [])

  // ── stopListening kept for backwards compat (same as confirm) ─────────
  const stopListening = confirmListening

  // ── Speak via ElevenLabs WebSocket TTS ───────────────────────────────
  const speak = useCallback((text, lang = 'en-IN') => {
    ttsWsRef.current?.close()
    sourceNodeRef.current?.stop()
    sourceNodeRef.current = null
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }

    setVoiceState('speaking')

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/tts`)
    ws.binaryType    = 'arraybuffer'
    ttsWsRef.current = ws

    const chunks = []
    let played   = false

    function playChunks() {
      if (played) return
      if (chunks.length === 0) { setVoiceState('ready'); return }
      played = true

      const totalLen = chunks.reduce((s, c) => s + c.length, 0)
      const merged   = new Uint8Array(totalLen)
      let offset = 0
      for (const c of chunks) { merged.set(c, offset); offset += c.length }

      const ctx = audioCtxRef.current
      if (ctx && ctx.state !== 'closed') {
        ctx.decodeAudioData(merged.buffer.slice(0))
          .then((audioBuffer) => {
            const source = ctx.createBufferSource()
            sourceNodeRef.current = source
            source.buffer  = audioBuffer
            source.connect(ctx.destination)
            source.onended = () => setVoiceState('ready')
            source.start(0)
          })
          .catch(() => playWithElement(merged))
      } else {
        playWithElement(merged)
      }
    }

    function playWithElement(merged) {
      const url   = URL.createObjectURL(new Blob([merged], { type: 'audio/mpeg' }))
      const audio = new Audio(url)
      audioRef.current  = audio
      audio.onended = () => { URL.revokeObjectURL(url); setVoiceState('ready') }
      audio.onerror = () => { URL.revokeObjectURL(url); setVoiceState('ready') }
      audio.play().catch(() => setVoiceState('ready'))
    }

    ws.onopen    = () => ws.send(JSON.stringify({ type: 'speak', text, lang }))
    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) { chunks.push(new Uint8Array(e.data)); return }
      let msg
      try { msg = JSON.parse(e.data) } catch { return }
      if (msg.type === 'done') { playChunks(); ws.close() }
      else if (msg.type === 'error') { setVoiceState('ready'); ws.close() }
    }
    ws.onerror = () => { if (!played) setVoiceState('ready') }
    ws.onclose = () => { if (!played && chunks.length > 0) playChunks(); else if (!played) setVoiceState('ready') }
  }, [])

  // ── Disconnect ───────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    recognitionRef.current?.abort()
    ttsWsRef.current?.close()
    sourceNodeRef.current?.stop()
    sourceNodeRef.current = null
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    setVoiceState('idle')
    setErrorMsg('')
  }, [])

  useEffect(() => () => disconnect(), [disconnect])

  return {
    voiceState,
    errorMsg,
    isSupported,
    connect,
    disconnect,
    startListening,
    stopListening,
    confirmListening,
    cancelListening,
    speak,
  }
}
