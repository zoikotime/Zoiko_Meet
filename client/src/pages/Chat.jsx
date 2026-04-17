import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, getWsBase } from '../api/client'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'
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

function dayLabel(iso) {
  try {
    const d = new Date(iso)
    const now = new Date()
    const yest = new Date(now)
    yest.setDate(yest.getDate() - 1)
    if (d.toDateString() === now.toDateString()) return 'Today'
    if (d.toDateString() === yest.toDateString()) return 'Yesterday'
    return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
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
  return { name: channel.name, color: '#7c8cff' }
}

// Group messages by day and collapse consecutive sends from same author within 3min
function groupMessages(messages) {
  const groups = []
  let currentDay = null
  let currentCluster = null
  for (const m of messages) {
    const day = new Date(m.created_at).toDateString()
    if (day !== currentDay) {
      currentDay = day
      groups.push({ type: 'divider', id: `d-${day}`, date: m.created_at })
      currentCluster = null
    }
    const lastCluster = currentCluster
    const sameAuthor = lastCluster && lastCluster.sender_id === m.sender_id
    const closeInTime =
      lastCluster && new Date(m.created_at) - new Date(lastCluster.messages[lastCluster.messages.length - 1].created_at) < 3 * 60 * 1000
    if (sameAuthor && closeInTime) {
      lastCluster.messages.push(m)
    } else {
      const cluster = {
        type: 'cluster',
        id: `c-${m.id}`,
        sender_id: m.sender_id,
        sender_name: m.sender_name,
        sender_color: m.sender_color,
        messages: [m],
      }
      groups.push(cluster)
      currentCluster = cluster
    }
  }
  return groups
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
  const [search, setSearch] = useState('')
  const wsRef = useRef(null)
  const messagesEndRef = useRef(null)
  const composerRef = useRef(null)

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

  // Auto-grow composer
  useEffect(() => {
    const el = composerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [draft])

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

  const filteredChannels = useMemo(() => {
    if (!search.trim()) return channels
    const q = search.trim().toLowerCase()
    return channels.filter((c) => {
      const display = channelDisplay(c, user.id)
      return (
        display.name.toLowerCase().includes(q) ||
        (c.last_message_preview || '').toLowerCase().includes(q)
      )
    })
  }, [channels, search, user.id])

  const grouped = useMemo(() => groupMessages(messages), [messages])

  return (
    <div className="chat">
      <aside className="chat-list">
        <div className="chat-list-header">
          <div className="chat-list-title">Chat</div>
          <button
            className="primary sm chat-new-btn"
            onClick={() => setShowNew(true)}
            aria-label="New conversation"
          >
            <Icon name="plus" size={14} /> New
          </button>
        </div>

        <div className="chat-search">
          <Icon name="search" size={14} className="chat-search-icon" />
          <input
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="chat-list-items">
          {channels.length === 0 && (
            <div className="chat-list-empty">
              <div className="chat-list-empty-icon"><Icon name="chat" size={28} /></div>
              <div className="chat-list-empty-title">No conversations yet</div>
              <div className="chat-list-empty-sub">Click <strong>+ New</strong> to start one.</div>
            </div>
          )}
          {filteredChannels.map((c) => {
            const display = channelDisplay(c, user.id)
            const active = String(c.id) === String(channelId)
            return (
              <button
                key={c.id}
                className={'chat-list-item' + (active ? ' active' : '')}
                onClick={() => navigate(`/chat/${c.id}`)}
              >
                <div className="chat-list-item-avatar">
                  <Avatar name={display.name} color={display.color} />
                  {c.is_direct && <span className="presence-dot" />}
                </div>
                <div className="chat-list-item-main">
                  <div className="chat-list-item-top">
                    <span className="chat-list-item-name">{display.name}</span>
                    {c.last_message_at && (
                      <span className="chat-list-item-time">{formatTime(c.last_message_at)}</span>
                    )}
                  </div>
                  <div className="chat-list-item-preview">
                    {c.last_message_preview || (c.is_direct ? 'Start a conversation' : 'No messages yet')}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </aside>

      <section className="chat-thread">
        {!activeChannel ? (
          <div className="chat-thread-empty">
            <div className="chat-thread-empty-card">
              <div className="chat-thread-empty-icon"><Icon name="chat" size={32} /></div>
              <h2>Start a conversation</h2>
              <p>Select someone from the list or create a new channel to begin chatting.</p>
              <button className="primary" onClick={() => setShowNew(true)}>
                <Icon name="plus" size={14} /> New conversation
              </button>
            </div>
          </div>
        ) : (
          <>
            {(() => {
              const display = channelDisplay(activeChannel, user.id)
              return (
                <header className="chat-thread-header">
                  <div className="chat-thread-header-avatar">
                    <Avatar name={display.name} color={display.color} />
                    {activeChannel.is_direct && <span className="presence-dot" />}
                  </div>
                  <div className="chat-thread-header-main">
                    <div className="chat-thread-header-name">{display.name}</div>
                    <div className="chat-thread-header-sub">
                      {activeChannel.is_direct ? (
                        <><span className="dot-online" /> Active now</>
                      ) : (
                        <><Icon name="users" size={12} /> {activeChannel.members.length} members</>
                      )}
                    </div>
                  </div>
                </header>
              )
            })()}

            <div className="chat-messages">
              {grouped.map((g) =>
                g.type === 'divider' ? (
                  <div key={g.id} className="chat-day-divider">
                    <span>{dayLabel(g.date)}</span>
                  </div>
                ) : (
                  <div
                    key={g.id}
                    className={'chat-cluster' + (g.sender_id === user.id ? ' mine' : '')}
                  >
                    <Avatar name={g.sender_name} color={g.sender_color} size="sm" />
                    <div className="chat-cluster-body">
                      <div className="chat-cluster-meta">
                        <span className="chat-cluster-name">{g.sender_name}</span>
                        <span className="chat-cluster-time">{formatTime(g.messages[0].created_at)}</span>
                      </div>
                      <div className="chat-cluster-msgs">
                        {g.messages.map((m) => (
                          <div key={m.id} className="chat-bubble">
                            {m.body}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className={'chat-typing' + (typingText ? ' active' : '')}>
              {typingText && (
                <>
                  <span className="typing-dots"><span /><span /><span /></span>
                  <span>{typingText}</span>
                </>
              )}
            </div>

            <div className="chat-composer">
              <textarea
                ref={composerRef}
                placeholder="Type a message. Enter to send, Shift+Enter for new line."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onComposerKey}
                rows={1}
              />
              <button
                className="primary chat-send"
                onClick={sendMessage}
                disabled={!draft.trim()}
                aria-label="Send"
              >
                <Icon name="send" size={16} />
              </button>
            </div>
          </>
        )}
      </section>

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
        <div className="new-channel-head">
          <h3>Start a conversation</h3>
          <button className="ghost new-channel-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
        {err && (
          <div className="auth-error">
            <Icon name="close" size={14} /> {err}
          </div>
        )}
        <div className="chat-search">
          <Icon name="search" size={14} className="chat-search-icon" />
          <input
            placeholder="Search people by name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="new-channel-users">
          {users.length === 0 && (
            <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>
              No users found.
            </div>
          )}
          {users.map((u) => (
            <button
              key={u.id}
              className={'new-channel-user' + (selected.has(u.id) ? ' selected' : '')}
              onClick={() => toggle(u.id)}
            >
              <Avatar name={u.name} color={u.avatar_color} size="sm" />
              <div className="new-channel-user-name">
                {u.name}
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{u.email}</div>
              </div>
              {selected.has(u.id) && (
                <span className="new-channel-user-check">
                  <Icon name="check" size={14} />
                </span>
              )}
            </button>
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
            {busy ? 'Creating…' : `Create${selected.size ? ` (${selected.size})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
