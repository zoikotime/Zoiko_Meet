import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Sign in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-pane">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="auth-brand-mark">Z</span>
            <span>Zoiko Meet</span>
          </div>
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-sub">Sign in to join meetings and chat with your team.</p>
          {error && <div className="auth-error">{error}</div>}
          <form className="auth-form" onSubmit={submit}>
            <div>
              <label className="auth-label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="auth-label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            New here? <Link to="/register">Create an account</Link>
          </div>
        </div>
      </div>
      <div className="auth-pane auth-hero">
        <div className="auth-hero-content">
          <h2>Meetings + chat, all in one place.</h2>
          <p>
            Quickly start a video meeting or pick up a conversation with your team — no
            context switching, no extra apps.
          </p>
          <div className="auth-features">
            <div className="auth-feature">
              <div className="auth-feature-icon">📹</div>
              <div className="auth-feature-title">HD Video Meetings</div>
              <div className="auth-feature-desc">One-click rooms with screen sharing.</div>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon">💬</div>
              <div className="auth-feature-title">Team Chat</div>
              <div className="auth-feature-desc">Channels and direct messages.</div>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon">🔗</div>
              <div className="auth-feature-title">Share a link</div>
              <div className="auth-feature-desc">Invite anyone with a meeting code.</div>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon">🔒</div>
              <div className="auth-feature-title">Secure</div>
              <div className="auth-feature-desc">Peer-to-peer video streams.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
