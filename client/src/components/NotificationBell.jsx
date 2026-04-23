import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getWsBase } from '../api/client'
import Icon from './Icon'
import './NotificationBell.css'

function timeAgo(iso) {
  try {
    const d = new Date(iso)
    const now = new Date()
    const mins = Math.floor((now - d) / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  } catch {
    return ''
  }
}

const NOTIF_ICONS = {
  meeting_invite: 'mail',
  meeting_reminder: 'clock',
  meeting_started: 'video',
  org_invite: 'building',
  chat_mention: 'chat',
  system: 'bell',
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [notifs, countData] = await Promise.all([
          api('/api/notifications?limit=20'),
          api('/api/notifications/unread-count'),
        ])
        if (cancelled) return
        setNotifications(notifs)
        setUnreadCount(countData.count)
      } catch { /* best-effort fetch */ }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Real-time WS connection
  useEffect(() => {
    const token = localStorage.getItem('zoiko_token')
    if (!token) return

    const ws = new WebSocket(`${getWsBase()}/ws/notifications?token=${encodeURIComponent(token)}`)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'notification') {
          setNotifications(prev => [data.notification, ...prev].slice(0, 20))
          setUnreadCount(prev => prev + 1)
        }
      } catch {}
    }

    const keepalive = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }))
      } else {
        clearInterval(keepalive)
      }
    }, 30000)

    return () => {
      clearInterval(keepalive)
      try { ws.close() } catch {}
    }
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const markRead = async (id) => {
    try {
      await api(`/api/notifications/${id}/read`, { method: 'POST' })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch {}
  }

  const markAllRead = async () => {
    try {
      await api('/api/notifications/read-all', { method: 'POST' })
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch {}
  }

  const handleClick = (notif) => {
    if (!notif.is_read) markRead(notif.id)
    try {
      const data = notif.data ? JSON.parse(notif.data) : {}
      if (data.meeting_code) {
        navigate(`/meet/${data.meeting_code}`)
        setOpen(false)
      } else if (data.org_slug) {
        navigate(`/org/${data.org_slug}`)
        setOpen(false)
      }
    } catch {}
  }

  return (
    <div className="notif-bell" ref={dropdownRef}>
      <button
        className="notif-bell-btn"
        onClick={() => setOpen(!open)}
        title="Notifications"
      >
        <Icon name={unreadCount > 0 ? 'bellDot' : 'bell'} size={18} />
        {unreadCount > 0 && (
          <span className="notif-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-head">
            <span className="notif-dropdown-title">Notifications</span>
            {unreadCount > 0 && (
              <button className="ghost notif-mark-all" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="notif-dropdown-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <Icon name="inbox" size={28} />
                <span>No notifications yet</span>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  className={'notif-item' + (n.is_read ? '' : ' unread')}
                  onClick={() => handleClick(n)}
                >
                  <div className="notif-item-icon">
                    <Icon name={NOTIF_ICONS[n.type] || 'bell'} size={16} />
                  </div>
                  <div className="notif-item-body">
                    <div className="notif-item-title">{n.title}</div>
                    {n.body && <div className="notif-item-text">{n.body}</div>}
                    <div className="notif-item-time">{timeAgo(n.created_at)}</div>
                  </div>
                  {!n.is_read && <span className="notif-item-dot" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
