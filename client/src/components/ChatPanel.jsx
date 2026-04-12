import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useChat } from '../hooks/useChat'
import { useCombinedChat } from '../hooks/useCombinedChat'
import { useReportChat } from '../hooks/useReportChat'
import { useVoice } from '../hooks/useVoice'
import { useLanguage } from '../context/LanguageContext'

// ── Format message content with bullet point support ─────────────────
function formatContent(text) {
  const lines = text.split('\n').filter(l => l.trim() !== '')
  if (lines.length <= 1) return <span>{text}</span>
  return (
    <ul className="space-y-1 list-none">
      {lines.map((line, i) => {
        const clean = line.replace(/^[\s•\-\*]+/, '').trim()
        return <li key={i}>{clean}</li>
      })}
    </ul>
  )
}

// ── Message bubble ───────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
          isUser
            ? 'bg-ink-900 text-white rounded-br-sm'
            : 'bg-card border border-ink-200 shadow-sm text-ink-900 rounded-bl-sm'
        }`}
      >
        {msg.message_type === 'voice' && (
          <span className="text-[11px] opacity-60 block mb-1 font-medium">
            {isUser ? '🎤 Voice' : '🔊 Voice'}
          </span>
        )}
        {formatContent(msg.content)}
      </div>
    </div>
  )
}

// ── Waveform bars (shown while recording) ────────────────────────────
function WaveformBars() {
  return (
    <>
      <style>{`
        @keyframes voiceWave {
          0%, 100% { height: 4px; }
          50% { height: 20px; }
        }
      `}</style>
      <div className="flex-1 h-12 bg-ink-100 rounded-2xl flex items-center justify-center gap-[4px] px-4 overflow-hidden">
        {[...Array(11)].map((_, i) => (
          <div
            key={i}
            style={{
              width: '3px',
              height: '4px',
              borderRadius: '2px',
              background: 'rgb(52, 120, 247)',
              animation: 'voiceWave 0.9s ease-in-out infinite',
              animationDelay: `${i * 0.07}s`,
            }}
          />
        ))}
      </div>
    </>
  )
}

// ── Main component ───────────────────────────────────────────────────
export default function ChatPanel({ reportId, isReportChat = false, greetingMessage = null }) {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const voiceLang = language === 'hi' ? 'hi-IN' : 'en-IN'

  const [mode, setMode] = useState('voice') // 'text' | 'voice'
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const autoListenRef = useRef(false)
  const mountedRef = useRef(false)

  const singleChat   = useChat(isReportChat ? null : (reportId ?? null))
  const combinedChat = useCombinedChat()
  const reportPageChat = useReportChat(isReportChat ? reportId : null)

  const activeHook = isReportChat ? reportPageChat : (reportId ? singleChat : combinedChat)
  const { messages: rawMessages, loading, sending, error: chatError, sendMessage } = activeHook

  const messages = !loading && rawMessages.length === 0 && greetingMessage
    ? [{ id: 'greeting', role: 'assistant', content: greetingMessage, message_type: 'text' }]
    : rawMessages

  const {
    voiceState, errorMsg: voiceError,
    connect, disconnect,
    startListening, confirmListening, cancelListening,
    speak,
  } = useVoice()

  const VOICE_LABELS = {
    idle:      t('mic_idle'),
    ready:     t('mic_ready'),
    listening: t('mic_listening'),
    thinking:  t('mic_thinking'),
    speaking:  t('mic_speaking'),
    error:     '',
  }

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  // Auto-start listening as soon as connection is ready
  useEffect(() => {
    if (voiceState === 'ready' && autoListenRef.current) {
      autoListenRef.current = false
      startListening(async (transcript) => {
        const reply = await sendMessage(transcript)
        if (reply) speak(reply, voiceLang)
      }, voiceLang)
    }
  }, [voiceState])

  function switchMode(next) {
    if (next === 'text' && mode === 'voice') disconnect()
    setMode(next)
  }

  function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || sending) return
    sendMessage(input)
    setInput('')
  }

  function handleMicTap() {
    if (voiceState === 'idle' || voiceState === 'error') {
      autoListenRef.current = true
      connect()
      return
    }
    if (voiceState === 'ready') {
      startListening(async (transcript) => {
        const reply = await sendMessage(transcript)
        if (reply) speak(reply, voiceLang)
      }, voiceLang)
    }
    // 'listening' state is handled by X / ✓ buttons
  }

  function handleConfirm() {
    confirmListening()
  }

  function handleCancel() {
    cancelListening()
  }

  const micDisabled = voiceState === 'thinking' || voiceState === 'speaking'
  const isRecording = voiceState === 'listening'

  return (
    <section className="bg-card border border-ink-200/60 rounded-2xl shadow-sm overflow-hidden">
      {/* Header + mode toggle */}
      <div className="bg-black px-5 py-4 rounded-t-2xl">
        <div className="flex bg-white/10 rounded-2xl p-1.5 gap-1.5">
          <button
            onClick={() => switchMode('voice')}
            className={`flex-1 flex items-center justify-center gap-2 text-[17px] font-bold py-3.5 rounded-xl transition-all ${
              mode === 'voice'
                ? 'bg-accent-500 text-white shadow-md'
                : 'bg-white/15 text-white/60 hover:bg-white/25 hover:text-white'
            }`}
          >
            {t('voice')}
            {mode === 'voice' && isRecording && (
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => switchMode('text')}
            className={`flex-1 text-[17px] font-bold py-3.5 rounded-xl transition-all ${
              mode === 'text'
                ? 'bg-accent-500 text-white shadow-md'
                : 'bg-white/15 text-white/60 hover:bg-white/25 hover:text-white'
            }`}
          >
            {t('text')}
          </button>
        </div>
      </div>

      {/* Message thread */}
      <div className="h-72 overflow-y-auto px-4 py-4 space-y-3 bg-surface">
        {loading ? (
          <p className="text-[14px] font-medium text-ink-400 text-center pt-4">{t('loading_conversation')}</p>
        ) : messages.length === 0 ? (
          <p className="text-[14px] font-medium text-ink-400 text-center pt-8 leading-relaxed">
            {t('chat_empty_line1')}<br />
            {t('chat_empty_line2')}
          </p>
        ) : (
          messages.map((msg, i) => <MessageBubble key={msg.id ?? i} msg={msg} />)
        )}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-card border border-ink-200 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-4 pb-4 pt-3 border-t border-ink-200/60 bg-card">
        {chatError && <p className="text-[13px] font-medium text-red-500 mb-2">{chatError}</p>}

        {/* ── Text mode ── */}
        {mode === 'text' && (
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('type_question')}
              disabled={sending}
              className="flex-1 border-2 border-ink-200 focus:border-accent-500 rounded-xl px-4 py-3 text-[15px] font-medium text-ink-900 placeholder-ink-400 outline-none transition-colors bg-white disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="bg-accent-500 hover:bg-accent-600 disabled:opacity-40 text-white px-5 py-3 rounded-xl transition-colors text-[14px] font-semibold shrink-0 shadow-sm"
            >
              {t('send')}
            </button>
          </form>
        )}

        {/* ── Voice mode ── */}
        {mode === 'voice' && (
          <div className="py-1">
            {isRecording ? (
              /* Recording: X | waveform | ✓ */
              <div className="flex items-center gap-3">
                {/* Cancel */}
                <button
                  onClick={handleCancel}
                  className="w-12 h-12 rounded-full bg-ink-200 hover:bg-ink-300 flex items-center justify-center shrink-0 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-ink-600">
                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                  </svg>
                </button>

                {/* Animated waveform */}
                <WaveformBars />

                {/* Confirm */}
                <button
                  onClick={handleConfirm}
                  className="w-12 h-12 rounded-full bg-accent-500 hover:bg-accent-600 flex items-center justify-center shrink-0 transition-colors shadow-md"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-white">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ) : (
              /* Idle / ready / thinking / speaking: mic button */
              <div className="flex flex-col items-center gap-3 py-1">
                {voiceError && (
                  <p className="text-[13px] font-medium text-red-500 text-center">{voiceError}</p>
                )}
                {!voiceError && (voiceState === 'thinking' || voiceState === 'speaking') && (
                  <p className="text-[13px] font-medium text-ink-400 text-center">
                    {VOICE_LABELS[voiceState]}
                  </p>
                )}

                <button
                  onClick={handleMicTap}
                  disabled={micDisabled}
                  aria-label={VOICE_LABELS[voiceState]}
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 disabled:cursor-not-allowed shadow-lg ${
                    micDisabled
                      ? 'bg-ink-200 text-ink-400'
                      : 'bg-accent-500 text-white hover:bg-accent-600'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                    <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4Z" />
                    <path d="M19 10a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V19H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.07A7 7 0 0 0 19 10Z" />
                  </svg>
                </button>

                {!voiceError && !micDisabled && (
                  <p className="text-[12px] font-medium text-ink-400 text-center">
                    {VOICE_LABELS[voiceState]}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
