import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
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

export default function Meet() {
  const navigate = useNavigate()
  const [recent, setRecent] = useState([])
  const [code, setCode] = useState('')
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
    if (cleaned) navigate(`/meet/${cleaned}`)
  }

  return (
    <div className="home">
      <header className="home-hero">
        <div className="home-hero-top">
          <span className="badge accent">
            <Icon name="video" size={12} />
            <span>Meetings</span>
          </span>
        </div>
        <h1 className="home-hero-title">
          Start or join a <span className="grad">meeting</span>
        </h1>
        <p className="home-hero-sub">Instant video calls, one link away.</p>
      </header>

      {err && (
        <div className="auth-error" style={{ marginBottom: 16 }}>
          <Icon name="close" size={14} /> {err}
        </div>
      )}

      <div className="home-grid" style={{ gridTemplateColumns: '1.5fr 1fr 1fr' }}>
        <article className="home-card home-card-featured">
          <div className="home-card-glow" />
          <div className="home-card-head">
            <div className="home-card-icon gradient"><Icon name="video" size={22} /></div>
            <span className="badge live">Live</span>
          </div>
          <h3>New meeting</h3>
          <p>Start an instant video call and copy the shareable link.</p>
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
            <div className="home-card-icon"><Icon name="link" size={22} /></div>
          </div>
          <h3>Join with code</h3>
          <p>Enter the meeting code to join.</p>
          <form className="home-card-actions" onSubmit={joinCode}>
            <input
              className="mono"
              placeholder="abc-defg-hij"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button type="submit" className="primary" disabled={!code.trim()}>Join</button>
          </form>
        </article>

        <article className="home-card">
          <div className="home-card-head">
            <div className="home-card-icon"><Icon name="calendar" size={22} /></div>
          </div>
          <h3>Schedule</h3>
          <p>Plan a meeting for later — share the code in advance.</p>
          <div className="home-card-actions">
            <button className="outline" disabled>Coming soon</button>
          </div>
        </article>
      </div>

      <section className="home-section">
        <div className="home-section-head">
          <div>
            <div className="home-section-title">Your meetings</div>
            <div className="home-section-sub">Rooms you've created or joined.</div>
          </div>
        </div>
        {recent.length === 0 ? (
          <div className="home-empty">
            <div className="home-empty-icon"><Icon name="video" size={24} /></div>
            <div>
              <div className="home-empty-title">No meetings yet</div>
              <div className="home-empty-sub">Start one above to see it listed here.</div>
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
                <div className="home-recent-icon"><Icon name="video" size={18} /></div>
                <div className="home-recent-body">
                  <div className="home-recent-title">{m.title}</div>
                  <div className="home-recent-code mono">{m.code}</div>
                </div>
                <div className="home-recent-meta">
                  {m.is_active ? (
                    <span className="badge live">Active</span>
                  ) : (
                    <><Icon name="clock" size={13} /> <span>{formatWhen(m.created_at)}</span></>
                  )}
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
