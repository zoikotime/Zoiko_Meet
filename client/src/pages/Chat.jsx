import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, getWsBase } from '../api/client'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import './Chat.css'

function formatTime(iso) {
  try {
    const d = new Date(iso)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

function channelDisplay(channel, currentUserId) {
  if (channel.is_direct) {
    const other = channel.members.find((m) => m.id !== currentUserId)
    return {
      name: other?.name || channel.name,
      color: other?.avatar_color || '#5b8def',
    }
  }
  return { name: channel.name, color: '#5b8def' }
}

export default function Chat() {
  const { channelId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [channels, setChannels] = useState([])
  const [messages, setMessages] = useState([])
  const [activeChannel, setActiveChannel] = useState(null)
  const [draft, setDraft] = useState('')
  const [typingUsers, setTypingUsers] = useState({})
  const [showNew, setShowNew] = useState(false)
  const wsRef = useRef(null)
  const messagesEndRef = useRef(null)

  const loadChannels = useCallback(async () => {
    const list = await api('/api/channels')
    setChannels(list)
    return list
  }, [])

  useEffect(() => {
    loadChannels().catch(() => {})
  }, [loadChannels])

  useEffect(() => {
    if (!channelId) {
      setActiveChannel(null)
      setMessages([])
      return
    }
    const ch = channels.find((c) => String(c.id) === String(channelId))
    if (ch) setActiveChannel(ch)
  }, [channelId, channels])

  useEffect(() => {
    if (!channelId) return
    let cancelled = false
    api(`/api/channels/${channelId}/messages`)
      .then((msgs) => {
        if (!cancelled) setMessages(msgs)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [channelId])

  useEffect(() => {
    if (!channelId) return
    if (wsRef.current) {
      try { wsRef.current.close() } catch {}
    }
    const token = localStorage.getItem('zoiko_token')
    const ws = new WebSocket(`${getWsBase()}/ws/channels/${channelId}?token=${encodeURIComponent(token)}`)
    wsRef.current = ws
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'message') {
          setMessages((prev) =>
            prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]
          )
          setChannels((prev) =>
            prev.map((c) =>
              c.id === data.message.channel_id
                ? {
                    ...c,
                    last_message_preview: data.message.body.slice(0, 120),
                    last_message_at: data.message.created_at,
                  }
                : c
            )
          )
        } else if (data.type === 'typing') {
          setTypingUsers((prev) => ({ ...prev, [data.user_id]: { name: data.name, at: Date.now() } }))
        }
      } catch {}
    }
    return () => {
      try { ws.close() } catch {}
    }
  }, [channelId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const t = setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now()
        const next = { ...prev }
        for (const k of Object.keys(next)) {
          if (now - next[k].at > 3500) delete next[k]
        }
        return next
      })
    }, 1500)
    return () => clearInterval(t)
  }, [])

  const sendMessage = () => {
    const body = draft.trim()
    if (!body || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'message', body }))
    setDraft('')
  }

  const onComposerKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    } else if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing' }))
    }
  }

  const typingText = useMemo(() => {
    const names = Object.values(typingUsers).map((t) => t.name)
    if (!names.length) return ''
    if (names.length === 1) return `${names[0]} is typing…`
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`
    return 'Several people are typing…'
  }, [typingUsers])

  return (
    <div className="chat">
      <div className="chat-list">
        <div className="chat-list-header">
          <div className="chat-list-title">Chat</div>
          <button className="primary" onClick={() => setShowNew(true)}>+ New</button>
        </div>
        <div className="chat-list-items">
          {channels.length === 0 && (
            <div style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>
              No conversations yet. Click <strong>+ New</strong> to start one.
            </div>
          )}
          {channels.map((c) => {
            const display = channelDisplay(c, user.id)
            const active = String(c.id) === String(channelId)
            return (
              <div
                key={c.id}
                className={'chat-list-item' + (active ? ' active' : '')}
                onClick={() => navigate(`/chat/${c.id}`)}
              >
                <Avatar name={display.name} color={display.color} />
                <div className="chat-list-item-main">
                  <div className="chat-list-item-name">{display.name}</div>
                  <div className="chat-list-item-preview">
                    {c.last_message_preview || (c.is_direct ? 'Start a conversation' : 'No messages yet')}
                  </div>
                </div>
                {c.last_message_at && (
                  <div className="chat-list-item-time">{formatTime(c.last_message_at)}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="chat-thread">
        {!activeChannel ? (
          <div className="chat-thread-empty">
            <div>
              <div style={{ fontSize: 42, marginBottom: 8 }}>💬</div>
              <div>Select a conversation or start a new one.</div>
            </div>
          </div>
        ) : (
          <>
            {(() => {
              const display = channelDisplay(activeChannel, user.id)
              return (
                <div className="chat-thread-header">
                  <Avatar name={display.name} color={display.color} />
                  <div className="chat-thread-header-main">
                    <div className="chat-thread-header-name">{display.name}</div>
                    <div className="chat-thread-header-sub">
                      {activeChannel.is_direct
                        ? 'Direct message'
                        : `${activeChannel.members.length} members`}
                    </div>
                  </div>
                </div>
              )
            })()}

            <div className="chat-messages">
              {messages.map((m) => (
                <div key={m.id} className={'chat-msg' + (m.sender_id === user.id ? ' mine' : '')}>
                  <Avatar name={m.sender_name} color={m.sender_color} size="sm" />
                  <div>
                    <div className="chat-msg-meta">
                      {m.sender_name} · {formatTime(m.created_at)}
                    </div>
                    <div className="chat-msg-body">
                      <div className="chat-msg-text">{m.body}</div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-typing">{typingText}</div>

            <div className="chat-composer">
              <textarea
                placeholder="Type a message. Press Enter to send, Shift+Enter for new line."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onComposerKey}
                rows={1}
              />
              <button className="primary" onClick={sendMessage} disabled={!draft.trim()}>
                Send
              </button>
            </div>
          </>
        )}
      </div>

      {showNew && (
        <NewChannelModal
          onClose={() => setShowNew(false)}
          onCreated={async (ch) => {
            setShowNew(false)
            await loadChannels()
            navigate(`/chat/${ch.id}`)
          }}
        />
      )}
    </div>
  )
}

function NewChannelModal({ onClose, onCreated }) {
  const [users, setUsers] = useState([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api(`/api/users${query ? `?q=${encodeURIComponent(query)}` : ''}`).then(setUsers).catch(() => {})
  }, [query])

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const create = async () => {
    const ids = Array.from(selected)
    if (!ids.length) {
      setErr('Pick at least one person.')
      return
    }
    setBusy(true)
    setErr('')
    try {
      const isDirect = ids.length === 1
      const selectedUsers = users.filter((u) => ids.includes(u.id))
      const fallbackName = selectedUsers.map((u) => u.name).join(', ')
      const ch = await api('/api/channels', {
        method: 'POST',
        body: {
          name: name.trim() || fallbackName || 'New channel',
          member_ids: ids,
          is_direct: isDirect,
        },
      })
      onCreated(ch)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="new-channel-modal" onClick={onClose}>
      <div className="new-channel-card" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0 }}>Start a conversation</h3>
        {err && <div className="auth-error">{err}</div>}
        <input
          placeholder="Search people by name or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="new-channel-users">
          {users.length === 0 && (
            <div style={{ padding: 12, color: 'var(--muted)', fontSize: 13 }}>No users found.</div>
          )}
          {users.map((u) => (
            <div
              key={u.id}
              className={'new-channel-user' + (selected.has(u.id) ? ' selected' : '')}
              onClick={() => toggle(u.id)}
            >
              <Avatar name={u.name} color={u.avatar_color} size="sm" />
              <div className="new-channel-user-name">
                {u.name}
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{u.email}</div>
              </div>
              {selected.has(u.id) && <span style={{ color: 'var(--primary)' }}>✓</span>}
            </div>
          ))}
        </div>
        {selected.size > 1 && (
          <input
            placeholder="Group name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <div className="new-channel-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={create} disabled={busy || selected.size === 0}>
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
