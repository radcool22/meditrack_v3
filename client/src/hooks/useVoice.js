import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Voice mode.
 *
 * STT : browser-native SpeechRecognition (unchanged)
 * TTS : ElevenLabs WebSocket streaming via /ws/tts backend proxy.
 *       AudioContext is unlocked on the first user tap (connect()),
 *       so audio.play() is never blocked by the browser's autoplay policy.
 */
export function useVoice() {
  const [voiceState, setVoiceState] = useState('idle')
  const [errorMsg, setErrorMsg]     = useState('')

  const recognitionRef = useRef(null)
  const ttsWsRef       = useRef(null)
  const audioCtxRef    = useRef(null)   // AudioContext — created on first user gesture
  const sourceNodeRef  = useRef(null)   // current AudioBufferSourceNode
  const audioRef       = useRef(null)   // fallback <audio> element

  const isSupported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  // ── Connect — also unlocks AudioContext on the user's tap ────────────
  const connect = useCallback(() => {
    setErrorMsg('')
    if (!isSupported) {
      setErrorMsg('Voice input is not supported in this browser. Please use Chrome or Safari.')
      setVoiceState('error')
      return
    }
    // Create / resume AudioContext while we are inside a user gesture
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
        console.log('[TTS] AudioContext created, state:', audioCtxRef.current.state)
      } else if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume()
        console.log('[TTS] AudioContext resumed')
      }
    } catch (e) {
      console.warn('[TTS] Could not create AudioContext:', e)
    }
    setVoiceState('ready')
  }, [isSupported])

  // ── Start listening ──────────────────────────────────────────────────
  const startListening = useCallback((onTranscript, lang = 'en-IN') => {
    if (voiceState !== 'ready') return

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const r  = new SR()
    r.lang            = lang
    r.continuous      = false
    r.interimResults  = false
    r.maxAlternatives = 1
    recognitionRef.current = r

    r.onstart  = () => setVoiceState('listening')
    r.onresult = (e) => {
      const text = e.results[0][0].transcript.trim()
      if (text) { setVoiceState('thinking'); onTranscript(text) }
      else setVoiceState('ready')
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
    r.onend = () => setVoiceState((s) => (s === 'listening' ? 'ready' : s))

    try { r.start() } catch {
      setErrorMsg('Could not start microphone. Please try again.')
      setVoiceState('ready')
    }
  }, [voiceState])

  // ── Stop early ───────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  // ── Speak via ElevenLabs WebSocket TTS ───────────────────────────────
  const speak = useCallback((text, lang = 'en-IN') => {
    // Cancel any in-progress TTS
    ttsWsRef.current?.close()
    sourceNodeRef.current?.stop()
    sourceNodeRef.current = null
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }

    console.log('[TTS] speak() called, text length:', text?.length)
    setVoiceState('speaking')

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/tts`)
    ws.binaryType    = 'arraybuffer'
    ttsWsRef.current = ws

    const chunks = []
    let played   = false

    // ── Play whatever chunks we have ──────────────────────────────────
    function playChunks() {
      if (played) return
      if (chunks.length === 0) { console.warn('[TTS] done received but 0 chunks'); setVoiceState('ready'); return }
      played = true

      const totalLen = chunks.reduce((s, c) => s + c.length, 0)
      const merged   = new Uint8Array(totalLen)
      let offset = 0
      for (const c of chunks) { merged.set(c, offset); offset += c.length }

      console.log('[TTS] playing', totalLen, 'bytes, chunks:', chunks.length)

      const ctx = audioCtxRef.current
      if (ctx && ctx.state !== 'closed') {
        // Primary: AudioContext — never blocked by autoplay policy
        ctx.decodeAudioData(merged.buffer.slice(0))
          .then((audioBuffer) => {
            const source = ctx.createBufferSource()
            sourceNodeRef.current = source
            source.buffer  = audioBuffer
            source.connect(ctx.destination)
            source.onended = () => { console.log('[TTS] AudioContext playback ended'); setVoiceState('ready') }
            source.start(0)
            console.log('[TTS] AudioContext playback started, duration:', audioBuffer.duration.toFixed(2), 's')
          })
          .catch((err) => {
            console.error('[TTS] AudioContext decode failed, falling back to <audio>:', err)
            playWithElement(merged)
          })
      } else {
        // Fallback: <audio> element
        playWithElement(merged)
      }
    }

    function playWithElement(merged) {
      const url   = URL.createObjectURL(new Blob([merged], { type: 'audio/mpeg' }))
      const audio = new Audio(url)
      audioRef.current  = audio
      audio.onended  = () => { URL.revokeObjectURL(url); console.log('[TTS] <audio> playback ended'); setVoiceState('ready') }
      audio.onerror  = (e) => { URL.revokeObjectURL(url); console.error('[TTS] <audio> error:', e); setVoiceState('ready') }
      audio.play()
        .then(() => console.log('[TTS] <audio> playback started'))
        .catch((err) => { console.error('[TTS] <audio> play() blocked:', err); setVoiceState('ready') })
    }

    ws.onopen = () => {
      console.log('[TTS] WS opened, sending speak request')
      ws.send(JSON.stringify({ type: 'speak', text, lang }))
    }

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        chunks.push(new Uint8Array(e.data))
        console.log('[TTS] chunk received:', e.data.byteLength, 'bytes, total chunks:', chunks.length)
        return
      }
      let msg
      try { msg = JSON.parse(e.data) } catch { return }
      console.log('[TTS] JSON from server:', msg.type)
      if (msg.type === 'done') {
        playChunks()
        ws.close()
      } else if (msg.type === 'error') {
        console.error('[TTS] server error')
        setVoiceState('ready')
        ws.close()
      }
    }

    ws.onerror = (e) => {
      console.error('[TTS] WS error:', e)
      if (!played) setVoiceState('ready')
    }

    // If the connection closes before we played (e.g. server sent done then closed),
    // try to play whatever chunks arrived
    ws.onclose = (e) => {
      console.log('[TTS] WS closed, code:', e.code, 'played:', played, 'chunks:', chunks.length)
      if (!played && chunks.length > 0) {
        console.log('[TTS] triggering playback from onclose fallback')
        playChunks()
      } else if (!played) {
        setVoiceState('ready')
      }
    }
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
    speak,
  }
}
