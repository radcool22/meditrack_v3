import { useState, useRef, useEffect } from 'react'
import { useChat } from '../hooks/useChat'
import { useCombinedChat } from '../hooks/useCombinedChat'
import { useVoice } from '../hooks/useVoice'

// ── Message bubble ───────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-[#181818] text-white rounded-br-sm'
            : 'bg-white border border-[#e0e0e0] text-[#181818] rounded-bl-sm'
        }`}
      >
        {msg.message_type === 'voice' && (
          <span className="text-[10px] opacity-50 block mb-1">
            {isUser ? '🎤 Voice' : '🔊 Voice'}
          </span>
        )}
        {msg.content}
      </div>
    </div>
  )
}

// ── Voice state labels ───────────────────────────────────────────────
const VOICE_LABELS = {
  idle:      'Tap the mic to start',
  ready:     'Tap the mic and speak',
  listening: 'Listening… tap to stop',
  thinking:  'Thinking…',
  speaking:  'Speaking…',
  error:     '',
}

const VOICE_MIC_STYLES = {
  idle:      'bg-[#181818] text-white hover:bg-[#333]',
  ready:     'bg-[#181818] text-white hover:bg-[#333]',
  listening: 'bg-[#bbf451] text-[#181818]',
  thinking:  'bg-[#e0e0e0] text-[#8e8e8e]',
  speaking:  'bg-[#e0e0e0] text-[#8e8e8e]',
  error:     'bg-[#181818] text-white hover:bg-[#333]',
}

// ── Main component ───────────────────────────────────────────────────
export default function ChatPanel({ reportId }) {
  const [mode, setMode] = useState('voice') // 'text' | 'voice'
  const [input, setInput] = useState('')
  const [lang, setLang] = useState('en-IN') // speech recognition language
  const bottomRef = useRef(null)

  const singleChat = useChat(reportId ?? null)
  const combinedChat = useCombinedChat()
  const { messages, loading, sending, error: chatError, sendMessage } = reportId ? singleChat : combinedChat
  const { voiceState, errorMsg: voiceError, connect, disconnect, startListening, stopListening, speak } =
    useVoice()

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

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

  // Tap mic: idle/error → connect → ready; ready → listen; listening → stop
  async function handleMicTap() {
    if (voiceState === 'idle' || voiceState === 'error') {
      connect()
      return
    }
    if (voiceState === 'ready') {
      startListening(async (transcript) => {
        const reply = await sendMessage(transcript)
        if (reply) speak(reply, lang)
      }, lang)
      return
    }
    if (voiceState === 'listening') {
      stopListening()
      return
    }
    // thinking / speaking — do nothing
  }

  const micDisabled = voiceState === 'thinking' || voiceState === 'speaking'
  const isListeningPulse = voiceState === 'listening'

  return (
    <section className="bg-white border border-[#e0e0e0] rounded-xl overflow-hidden">
      {/* Header + mode toggle */}
      <div className="px-5 pt-5 pb-4 border-b border-[#e0e0e0]">
        <h2 className="text-xs font-medium uppercase tracking-widest text-[#8e8e8e] mb-3">
          Ask about this report
        </h2>
        <div className="flex bg-[#f5f5f5] rounded-lg p-1">
          <button
            onClick={() => switchMode('text')}
            className={`flex-1 text-sm font-medium py-2.5 rounded-md transition-colors ${
              mode === 'text'
                ? 'bg-white text-[#181818] shadow-sm'
                : 'text-[#8e8e8e] hover:text-[#181818]'
            }`}
          >
            Text
          </button>
          <button
            onClick={() => switchMode('voice')}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 rounded-md transition-colors ${
              mode === 'voice'
                ? 'bg-white text-[#181818] shadow-sm'
                : 'text-[#8e8e8e] hover:text-[#181818]'
            }`}
          >
            Voice
            {mode === 'voice' && voiceState === 'listening' && (
              <span className="w-2 h-2 rounded-full bg-[#bbf451] animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Message thread */}
      <div className="h-72 overflow-y-auto px-4 py-4 space-y-3 bg-[#f9f9f9]">
        {loading ? (
          <p className="text-xs text-[#8e8e8e] text-center pt-4">Loading conversation…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-[#8e8e8e] text-center pt-8 leading-relaxed">
            Ask anything about your report —<br />
            what a value means, why it matters, what to do next.
          </p>
        ) : (
          messages.map((msg, i) => <MessageBubble key={msg.id ?? i} msg={msg} />)
        )}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white border border-[#e0e0e0] rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8e8e8e] animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#8e8e8e] animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#8e8e8e] animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-4 pb-4 pt-3 border-t border-[#e0e0e0]">
        {chatError && <p className="text-xs text-red-500 mb-2">{chatError}</p>}

        {/* ── Text mode ── */}
        {mode === 'text' && (
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question…"
              disabled={sending}
              className="flex-1 border border-[#e0e0e0] focus:border-[#181818] rounded-lg px-3 py-3 text-sm text-[#181818] placeholder-[#8e8e8e] outline-none transition-colors bg-white disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="bg-[#181818] hover:bg-[#bbf451] hover:text-[#181818] disabled:opacity-40 text-white px-4 py-3 rounded-lg transition-colors text-sm font-medium shrink-0"
            >
              Send
            </button>
          </form>
        )}

        {/* ── Voice mode ── */}
        {mode === 'voice' && (
          <div className="flex flex-col items-center gap-3 py-2">
            {/* Language selector */}
            <div className="flex bg-[#f5f5f5] rounded-lg p-0.5 self-stretch">
              <button
                onClick={() => setLang('en-IN')}
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                  lang === 'en-IN' ? 'bg-white text-[#181818] shadow-sm' : 'text-[#8e8e8e]'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLang('hi-IN')}
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                  lang === 'hi-IN' ? 'bg-white text-[#181818] shadow-sm' : 'text-[#8e8e8e]'
                }`}
              >
                हिंदी
              </button>
            </div>

            {/* Status label */}
            <p className="text-xs text-[#8e8e8e] text-center min-h-[1rem]">
              {voiceError || VOICE_LABELS[voiceState]}
            </p>

            {/* Large mic button */}
            <button
              onClick={handleMicTap}
              disabled={micDisabled}
              aria-label={VOICE_LABELS[voiceState]}
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 disabled:cursor-not-allowed ${
                VOICE_MIC_STYLES[voiceState]
              } ${isListeningPulse ? 'animate-pulse' : ''}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-9 h-9"
              >
                <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4Z" />
                <path d="M19 10a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V19H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.07A7 7 0 0 0 19 10Z" />
              </svg>
            </button>

            {voiceState === 'listening' && (
              <p className="text-xs font-medium text-[#181818] bg-[#bbf451] px-4 py-1.5 rounded-full">
                Listening — tap to stop
              </p>
            )}
            {voiceState === 'thinking' && (
              <p className="text-xs text-[#8e8e8e]">Getting answer…</p>
            )}
            {voiceState === 'speaking' && (
              <p className="text-xs text-[#8e8e8e]">Speaking — please wait</p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
