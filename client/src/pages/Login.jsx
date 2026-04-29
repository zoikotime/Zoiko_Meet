import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Icon from '../components/Icon'
import './Auth.css'

const FEATURES = [
  { icon: 'video', title: 'HD video meetings', desc: 'One-click rooms with screen sharing.' },
  { icon: 'chat', title: 'Team chat', desc: 'Channels, DMs and realtime messages.' },
  { icon: 'link', title: 'Share a link', desc: 'Invite anyone with a meeting code.' },
  { icon: 'shield', title: 'Peer-to-peer', desc: 'Direct streams, low latency.' },
]

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
            <span>Zoiko sema</span>
          </div>
          <h1>
            Meetings and chat,<br />
            <span className="grad">beautifully together.</span>
          </h1>
          <p className="auth-hero-sub">
            Jump into a video call or pick up a conversation with your team — no context
            switching, no extra apps.
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
