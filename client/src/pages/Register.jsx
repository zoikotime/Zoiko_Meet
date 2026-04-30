import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Icon from '../components/Icon'
import './Auth.css'

const FEATURES = [
  { icon: 'video', title: 'Meet, like Google Meet', desc: 'Instant rooms, screen share, recording.' },
  { icon: 'chat', title: 'Chat, like Teams', desc: 'Channels, threads, files, presence.' },
  { icon: 'screen', title: 'Webinar, like Zoom', desc: 'Host up to 1000 with crisp video.' },
  { icon: 'robot', title: 'AI built-in', desc: 'Live captions, recap, action items.' },
]

const TRUST = ['End-to-end encrypted', 'SOC 2 ready', '99.9% uptime', 'GDPR']

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must contain uppercase, lowercase, and a digit')
      return
    }
    setBusy(true)
    try {
      await register(email.trim(), name.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Sign up failed')
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
            One workspace.<br />
            <span className="grad">Three best-in-class apps.</span>
          </h1>
          <p className="auth-hero-sub">
            Stop juggling Meet, Teams, and Zoom. ZoikoSema unifies HD video, persistent
            chat, and webinar-grade calls — with AI baked in — for teams that move fast.
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
          <h1 className="auth-title">Create your account</h1>
          <p className="auth-sub">Get started with video meetings and team chat.</p>
          {error && (
            <div className="auth-error">
              <Icon name="close" size={14} /> {error}
            </div>
          )}
          <form className="auth-form" onSubmit={submit}>
            <div className="auth-field">
              <label className="auth-label">Full name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                placeholder="Jane Doe"
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
                minLength={8}
                placeholder="At least 8 characters (A-z, 0-9)"
              />
            </div>
            <button type="submit" className="primary auth-submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create account'}
            </button>
          </form>
          <div className="auth-divider">Already have an account</div>
          <div className="auth-footer">
            <Link to="/login">Sign in →</Link>
          </div>
        </section>
      </div>
    </div>
  )
}
