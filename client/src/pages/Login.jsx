import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Icon from '../components/Icon'
import './Auth.css'

const FEATURES = [
  { icon: 'video', title: 'HD video meetings', desc: 'Up to 1080p, screen share, recording, captions.' },
  { icon: 'chat', title: 'Persistent team chat', desc: 'Channels, DMs, threads, file sharing.' },
  { icon: 'robot', title: 'AI co-pilot', desc: 'Live captions, recap, action items.' },
  { icon: 'shield', title: 'Enterprise-grade', desc: 'Encrypted, SSO-ready, audit logs.' },
]

const TRUST = ['End-to-end encrypted', 'SOC 2 ready', '99.9% uptime', 'GDPR']

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
      <div className="auth-grid" />
      <div className="auth-orb-3" />
      <div className="auth-shell">
        <section className="auth-hero">
          <div className="auth-hero-logo">
            <span className="auth-hero-logo-mark">Z</span>
            <span className="auth-hero-logo-text">ZoikoSema</span>
            <span className="auth-hero-logo-pill">Workspace</span>
          </div>
          <h1>
            Meetings, chat, and AI<br />
            <span className="grad">in one workspace.</span>
          </h1>
          <p className="auth-hero-sub">
            The unified collaboration platform — Google Meet-grade video, Teams-style
            persistent chat, and a Zoom-class meeting experience. Built for teams that
            ship.
          </p>
          <div className="auth-hero-features">
            {FEATURES.map((f) => (
              <div key={f.title} className="auth-feature">
                <div className="auth-feature-icon"><Icon name={f.icon} size={18} /></div>
                <div className="auth-feature-title">{f.title}</div>
                <div className="auth-feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
          <div className="auth-trust">
            {TRUST.map((t) => (
              <span key={t} className="auth-trust-pill">
                <Icon name="shield" size={11} /> {t}
              </span>
            ))}
          </div>
        </section>

        <section className="auth-card">
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-sub">Sign in to join meetings and chat with your team.</p>
          {error && (
            <div className="auth-error">
              <Icon name="close" size={14} /> {error}
            </div>
          )}
          <form className="auth-form" onSubmit={submit}>
            <div className="auth-field">
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
            <div className="auth-field">
              <label className="auth-label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>
            <button type="submit" className="primary auth-submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <div className="auth-divider">New here</div>
          <div className="auth-footer">
            <Link to="/register">Create your account →</Link>
          </div>
        </section>
      </div>
    </div>
  )
}
