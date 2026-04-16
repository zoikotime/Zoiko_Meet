import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import './Home.css'

function formatWhen(iso) {
  try {
    const d = new Date(iso)
    return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return ''
  }
}

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [recent, setRecent] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    api('/api/meetings/recent').then(setRecent).catch(() => {})
  }, [])

  const startInstant = async () => {
    setBusy(true)
    setErr('')
    try {
      const meeting = await api('/api/meetings', {
        method: 'POST',
        body: { title: 'Instant meeting' },
      })
      navigate(`/meet/${meeting.code}`)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const joinCode = (e) => {
    e.preventDefault()
    const cleaned = code.trim().toLowerCase()
    if (!cleaned) return
    navigate(`/meet/${cleaned}`)
  }

  return (
    <div className="home">
      <div className="home-hero">
        <div>
          <h1>Welcome, {user?.name?.split(' ')[0] || 'there'} 👋</h1>
          <p>Jump into a meeting or pick up a conversation.</p>
        </div>
      </div>

      {err && <div className="auth-error" style={{ marginBottom: 16 }}>{err}</div>}

      <div className="home-grid">
        <div className="home-card">
          <div className="home-card-icon">📹</div>
          <h3>New meeting</h3>
          <p>Start an instant video call and share the link with others.</p>
          <div className="home-card-actions">
            <button className="primary" onClick={startInstant} disabled={busy}>
              {busy ? 'Starting…' : 'Start instant meeting'}
            </button>
          </div>
        </div>

        <div className="home-card">
          <div className="home-card-icon">🔗</div>
          <h3>Join with code</h3>
          <p>Enter the meeting code someone shared with you.</p>
          <form className="home-card-actions" onSubmit={joinCode}>
            <input
              placeholder="abc-defg-hij"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button type="submit" className="primary" disabled={!code.trim()}>
              Join
            </button>
          </form>
        </div>

        <div className="home-card">
          <div className="home-card-icon">💬</div>
          <h3>Team chat</h3>
          <p>Continue a channel conversation or start a direct message.</p>
          <div className="home-card-actions">
            <button onClick={() => navigate('/chat')}>Open chat</button>
          </div>
        </div>
      </div>

      <div className="home-section">
        <div className="home-section-title">Recent meetings</div>
        {recent.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            No meetings yet — start one above to see it here.
          </p>
        ) : (
          <div className="home-recent">
            {recent.map((m) => (
              <div
                key={m.id}
                className="home-recent-item"
                onClick={() => navigate(`/meet/${m.code}`)}
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer' }}
              >
                <div className="home-card-icon">📹</div>
                <div className="home-recent-title">
                  {m.title}
                  <div className="home-recent-code">{m.code}</div>
                </div>
                <div className="home-recent-date">{formatWhen(m.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
