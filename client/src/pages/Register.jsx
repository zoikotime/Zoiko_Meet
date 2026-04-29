import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Icon from '../components/Icon'
import './Auth.css'

const FEATURES = [
  { icon: 'bolt', title: 'Start in seconds', desc: 'Instant meetings, no scheduling.' },
  { icon: 'users', title: 'Invite your team', desc: 'Channels, DMs, presence.' },
  { icon: 'screen', title: 'Share your screen', desc: 'One tap to present anything.' },
  { icon: 'sparkle', title: 'Delightful UX', desc: 'Crafted with care in every pixel.' },
]

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
            <span>Zoiko sema</span>
          </div>
          <h1>
            Everything your team<br />
            needs to <span className="grad">collaborate.</span>
          </h1>
          <p className="auth-hero-sub">
            Video meetings, persistent chat, and one simple home — built for your team.
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
