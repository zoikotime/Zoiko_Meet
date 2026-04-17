import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import Icon from '../components/Icon'
import './Home.css'

function formatWhen(iso) {
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now - d
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Good night'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
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

  const firstName = user?.name?.split(' ')[0] || 'there'
  const today = new Date().toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="home">
      <header className="home-hero">
        <div className="home-hero-top">
          <span className="badge accent">
            <Icon name="sparkle" size={12} />
            <span>Welcome to Zoiko</span>
          </span>
          <span className="home-hero-date">{today}</span>
        </div>
        <h1 className="home-hero-title">
          {greeting()}, <span className="grad">{firstName}</span>
        </h1>
        <p className="home-hero-sub">
          Jump into a meeting, share a link, or keep a conversation going.
        </p>
      </header>

      {err && (
        <div className="auth-error" style={{ marginBottom: 16 }}>
          <Icon name="close" size={14} /> {err}
        </div>
      )}

      <div className="home-grid">
        <article className="home-card home-card-featured">
          <div className="home-card-glow" />
          <div className="home-card-head">
            <div className="home-card-icon gradient">
              <Icon name="video" size={22} />
            </div>
            <span className="badge live">Live</span>
          </div>
          <h3>New meeting</h3>
          <p>Start an instant video call and share the link with anyone.</p>
          <div className="home-card-actions">
            <button className="primary lg" onClick={startInstant} disabled={busy}>
              {busy ? (
                <><span className="spinner" style={{ width: 16, height: 16 }} /> Starting…</>
              ) : (
                <><Icon name="bolt" size={16} /> Start instant meeting</>
              )}
            </button>
          </div>
        </article>

        <article className="home-card">
          <div className="home-card-head">
            <div className="home-card-icon">
              <Icon name="link" size={22} />
            </div>
          </div>
          <h3>Join with code</h3>
          <p>Enter the meeting code someone shared with you.</p>
          <form className="home-card-actions" onSubmit={joinCode}>
            <input
              placeholder="abc-defg-hij"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mono"
            />
            <button type="submit" className="primary" disabled={!code.trim()}>
              Join
            </button>
          </form>
        </article>

        <article className="home-card">
          <div className="home-card-head">
            <div className="home-card-icon">
              <Icon name="chat" size={22} />
            </div>
          </div>
          <h3>Team chat</h3>
          <p>Continue a channel conversation or start a new DM.</p>
          <div className="home-card-actions">
            <button onClick={() => navigate('/chat')} className="outline">
              Open chat <Icon name="arrowLeft" size={14} style={{ transform: 'rotate(180deg)' }} />
            </button>
          </div>
        </article>
      </div>

      <section className="home-section">
        <div className="home-section-head">
          <div>
            <div className="home-section-title">Recent meetings</div>
            <div className="home-section-sub">Your latest rooms — click to rejoin.</div>
          </div>
        </div>
        {recent.length === 0 ? (
          <div className="home-empty">
            <div className="home-empty-icon"><Icon name="calendar" size={24} /></div>
            <div>
              <div className="home-empty-title">No meetings yet</div>
              <div className="home-empty-sub">Start one above to see it here.</div>
            </div>
          </div>
        ) : (
          <div className="home-recent">
            {recent.map((m) => (
              <button
                key={m.id}
                className="home-recent-item"
                onClick={() => navigate(`/meet/${m.code}`)}
              >
                <div className="home-recent-icon">
                  <Icon name="video" size={18} />
                </div>
                <div className="home-recent-body">
                  <div className="home-recent-title">{m.title}</div>
                  <div className="home-recent-code mono">{m.code}</div>
                </div>
                <div className="home-recent-meta">
                  <Icon name="clock" size={13} />
                  <span>{formatWhen(m.created_at)}</span>
                </div>
                <div className="home-recent-chev">
                  <Icon name="arrowLeft" size={16} style={{ transform: 'rotate(180deg)' }} />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
