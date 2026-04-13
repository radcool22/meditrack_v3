import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { friendly } from '../utils/friendlyError'

export function useChat(reportId) {
  const { token } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const headers = { Authorization: `Bearer ${token}` }

  // Load history on mount
  useEffect(() => {
    if (!reportId || !token) return
    axios
      .get(`/api/chat/${reportId}/history`, { headers })
      .then(({ data }) => setMessages(data.messages ?? []))
      .catch(() => setError(friendly('the chat history not loading')))
      .finally(() => setLoading(false))
  }, [reportId, token])

  const sendMessage = useCallback(
    async (text) => {
      if (!text.trim() || sending) return

      const userMsg = { id: Date.now(), role: 'user', content: text.trim(), message_type: 'text' }
      setMessages((prev) => [...prev, userMsg])
      setSending(true)
      setError('')

      try {
        const history = messages.map((m) => ({ role: m.role, content: m.content }))
        const { data } = await axios.post(
          `/api/chat/${reportId}`,
          { message: text.trim(), history },
          { headers }
        )
        const assistantMsg = {
          id: Date.now() + 1,
          role: 'assistant',
          content: data.reply,
          message_type: 'text',
        }
        setMessages((prev) => [...prev, assistantMsg])
        return data.reply
      } catch {
        setError(friendly('your message not being sent'))
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
        return null
      } finally {
        setSending(false)
      }
    },
    [messages, sending, reportId, token]
  )

  const appendVoiceTurn = useCallback((userText, assistantText) => {
    const now = Date.now()
    setMessages((prev) => [
      ...prev,
      { id: now, role: 'user', content: userText, message_type: 'voice' },
      { id: now + 1, role: 'assistant', content: assistantText, message_type: 'voice' },
    ])
  }, [])

  return { messages, loading, sending, error, sendMessage, appendVoiceTurn }
}
