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
            ? 'bg-teal-700 text-white rounded-br-sm'
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

const VOICE_MIC_STYLES = {
  idle:      'bg-teal-700 text-white hover:bg-teal-600',
  ready:     'text-white',
  listening: 'text-white',
  thinking:  'bg-ink-200 text-ink-400',
  speaking:  'bg-ink-200 text-ink-400',
  error:     'bg-teal-700 text-white hover:bg-teal-600',
}

// ── Main component ───────────────────────────────────────────────────
export default function ChatPanel({ reportId, isReportChat = false, greetingMessage = null }) {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const voiceLang = language === 'hi' ? 'hi-IN' : 'en-IN'

  const [mode, setMode] = useState('voice') // 'text' | 'voice'
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const autoListenRef = useRef(false) // flag: start listening as soon as ready

  const singleChat = useChat(isReportChat ? null : (reportId ?? null))
  const combinedChat = useCombinedChat()
  const reportPageChat = useReportChat(isReportChat ? reportId : null)

  const activeHook = isReportChat ? reportPageChat : (reportId ? singleChat : combinedChat)
  const { messages: rawMessages, loading, sending, error: chatError, sendMessage } = activeHook

  // Inject greeting as first message when history is empty after loading
  const messages = !loading && rawMessages.length === 0 && greetingMessage
    ? [{ id: 'greeting', role: 'assistant', content: greetingMessage, message_type: 'text' }]
    : rawMessages
  const { voiceState, errorMsg: voiceError, connect, disconnect, startListening, stopListening, speak } =
    useVoice()

  const VOICE_LABELS = {
    idle:      t('mic_idle'),
    ready:     t('mic_ready'),
    listening: t('mic_listening'),
    thinking:  t('mic_thinking'),
    speaking:  t('mic_speaking'),
    error:     '',
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  // Auto-start listening once AudioContext is ready (after connect())
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
      // First tap: unlock AudioContext then immediately start listening
      autoListenRef.current = true
      connect()
      return
    }
    if (voiceState === 'ready') {
      startListening(async (transcript) => {
        const reply = await sendMessage(transcript)
        if (reply) speak(reply, voiceLang)
      }, voiceLang)
      return
    }
    if (voiceState === 'listening') {
      stopListening()
      return
    }
  }

  const micDisabled = voiceState === 'thinking' || voiceState === 'speaking'
  const micActive = voiceState === 'ready' || voiceState === 'listening'

  return (
    <section className="bg-card border border-ink-200/60 rounded-2xl shadow-sm overflow-hidden">
      {/* Header + mode toggle */}
      <div className="bg-teal-900 px-5 py-4 rounded-t-2xl">
        <h2 className="text-[13px] font-semibold uppercase tracking-widest text-teal-100/70 mb-3">
          {t('ask_about_report')}
        </h2>
        <div className="flex bg-white/10 rounded-2xl p-1.5 gap-1.5">
          <button
            onClick={() => switchMode('voice')}
            className={`flex-1 flex items-center justify-center gap-2 text-[17px] font-bold py-3.5 rounded-xl transition-all ${
              mode === 'voice'
                ? 'bg-teal-600 text-white shadow-md'
                : 'bg-white/15 text-white/60 hover:bg-white/25 hover:text-white'
            }`}
          >
            {t('voice')}
            {mode === 'voice' && voiceState === 'listening' && (
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => switchMode('text')}
            className={`flex-1 text-[17px] font-bold py-3.5 rounded-xl transition-all ${
              mode === 'text'
                ? 'bg-teal-600 text-white shadow-md'
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
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce [animation-delay:300ms]" />
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
              className="flex-1 border-2 border-ink-200 focus:border-teal-600 rounded-xl px-4 py-3 text-[15px] font-medium text-ink-900 placeholder-ink-400 outline-none transition-colors bg-white disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="bg-teal-700 hover:bg-teal-600 disabled:opacity-40 text-white px-5 py-3 rounded-xl transition-colors text-[14px] font-semibold shrink-0 shadow-sm"
            >
              {t('send')}
            </button>
          </form>
        )}

        {/* ── Voice mode ── */}
        {mode === 'voice' && (
          <div className="flex flex-col items-center gap-3 py-2">
            <p className="text-[13px] font-medium text-ink-400 text-center min-h-[1rem]">
              {voiceError || VOICE_LABELS[voiceState]}
            </p>

            <button
              onClick={handleMicTap}
              disabled={micDisabled}
              aria-label={VOICE_LABELS[voiceState]}
              style={micActive ? { backgroundColor: '#FF6B4A' } : undefined}
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 disabled:cursor-not-allowed shadow-lg ${
                VOICE_MIC_STYLES[voiceState]
              } ${micActive ? 'animate-pulse' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-9 h-9">
                <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4Z" />
                <path d="M19 10a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V19H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.07A7 7 0 0 0 19 10Z" />
              </svg>
            </button>

            {voiceState === 'listening' && (
              <p className="text-[13px] font-medium text-ink-400">{t('mic_listening_stop')}</p>
            )}
            {voiceState === 'thinking' && (
              <p className="text-[13px] font-medium text-ink-400">{t('mic_getting_answer')}</p>
            )}
            {voiceState === 'speaking' && (
              <p className="text-[13px] font-medium text-ink-400">{t('mic_speaking_wait')}</p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
