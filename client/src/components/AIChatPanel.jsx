import { useState, useRef, useEffect } from 'react'
import { api } from '../api/client'
import Icon from './Icon'
import './AIChatPanel.css'

const QUICK_ACTIONS = [
  { label: 'Summarize chat', prompt: 'Please summarize the meeting chat so far.' },
  { label: 'Generate notes', prompt: 'Generate meeting notes with action items from the discussion.' },
  { label: 'Meeting tips', prompt: 'Give me some tips for running an effective meeting.' },
  { label: 'Help', prompt: 'What can you help me with?' },
]

export default function AIChatPanel({ meetingContext, onClose, embedded = false }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    const userMsg = text || input.trim()
    if (!userMsg) return
    setInput('')

    const newMessages = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const body = {
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
      }
      if (meetingContext) body.meeting_context = meetingContext
      const res = await api('/api/ai/chat', { method: 'POST', body })
      setMessages(prev => [...prev, { role: 'assistant', content: res.response }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }])
    } finally {
      setLoading(false)
    }
  }

  const summarize = async () => {
    if (!meetingContext?.chat_log) {
      sendMessage('Please summarize the meeting chat so far.')
      return
    }
    setLoading(true)
    setMessages(prev => [...prev, { role: 'user', content: 'Summarize the meeting chat.' }])
    try {
      const res = await api('/api/ai/summarize', {
        method: 'POST',
        body: {
          chat_log: meetingContext.chat_log,
          meeting_title: meetingContext.title || 'Meeting',
        },
      })
      setMessages(prev => [...prev, { role: 'assistant', content: res.summary }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={'ai-chat-panel' + (embedded ? ' embedded' : '')}>
      <div className="ai-chat-head">
        <div className="ai-chat-head-left">
          <div className="ai-chat-avatar">
            <Icon name="robot" size={18} />
          </div>
          <div>
            <div className="ai-chat-head-title">Zoiko AI</div>
            <div className="ai-chat-head-sub">Your meeting assistant</div>
          </div>
        </div>
        {onClose && (
          <button className="ghost" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      <div className="ai-chat-messages">
        {messages.length === 0 && (
          <div className="ai-chat-welcome">
            <div className="ai-chat-welcome-icon">
              <Icon name="robot" size={32} />
            </div>
            <h3>Hi! I'm Zoiko AI</h3>
            <p>I can help you with meeting summaries, notes, tips, and more.</p>
            <div className="ai-chat-quick-actions">
              {QUICK_ACTIONS.map((a, i) => (
                <button
                  key={i}
                  className="ai-quick-btn"
                  onClick={() => a.label === 'Summarize chat' ? summarize() : sendMessage(a.prompt)}
                >
                  <Icon name="zap" size={12} />
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={'ai-msg ' + m.role}>
            {m.role === 'assistant' && (
              <div className="ai-msg-avatar">
                <Icon name="robot" size={14} />
              </div>
            )}
            <div className="ai-msg-bubble">
              <div className="ai-msg-content">{m.content}</div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="ai-msg assistant">
            <div className="ai-msg-avatar">
              <Icon name="robot" size={14} />
            </div>
            <div className="ai-msg-bubble">
              <div className="ai-typing">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="ai-chat-composer">
        <input
          placeholder="Ask Zoiko AI anything..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          disabled={loading}
        />
        <button
          className="primary ai-send-btn"
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
        >
          <Icon name="send" size={16} />
        </button>
      </div>
    </div>
  )
}
