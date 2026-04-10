import { useState, useCallback } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

export function useCombinedChat() {
  const { token } = useAuth()
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const headers = { Authorization: `Bearer ${token}` }

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
          '/api/chat/combined',
          { message: text.trim(), history },
          { headers }
        )
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, role: 'assistant', content: data.reply, message_type: 'text' },
        ])
        return data.reply
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to send message')
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
        return null
      } finally {
        setSending(false)
      }
    },
    [messages, sending, token]
  )

  return { messages, loading: false, sending, error, sendMessage }
}
