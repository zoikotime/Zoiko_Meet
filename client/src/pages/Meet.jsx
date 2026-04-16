import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import './Home.css'

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
      <div className="home-hero">
        <div>
          <h1>Meet</h1>
          <p>Start a new meeting or join an existing one.</p>
        </div>
      </div>
      {err && <div className="auth-error" style={{ marginBottom: 16 }}>{err}</div>}
      <div className="home-grid">
        <div className="home-card">
          <div className="home-card-icon">📹</div>
          <h3>New meeting</h3>
          <p>Start an instant video call.</p>
          <div className="home-card-actions">
            <button className="primary" onClick={startInstant} disabled={busy}>
              {busy ? 'Starting…' : 'Start instant meeting'}
            </button>
          </div>
        </div>
        <div className="home-card">
          <div className="home-card-icon">🔗</div>
          <h3>Join with code</h3>
          <p>Enter the meeting code to join.</p>
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
      </div>

      <div className="home-section">
        <div className="home-section-title">Your meetings</div>
        {recent.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>No meetings yet.</p>
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
                <div className="home-recent-date">
                  {m.is_active ? 'Active' : 'Ended'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
