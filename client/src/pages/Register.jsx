import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

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
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
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
      <div className="auth-pane">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="auth-brand-mark">Z</span>
            <span>Zoiko Meet</span>
          </div>
          <h1 className="auth-title">Create your account</h1>
          <p className="auth-sub">Get started with video meetings and team chat.</p>
          {error && <div className="auth-error">{error}</div>}
          <form className="auth-form" onSubmit={submit}>
            <div>
              <label className="auth-label">Full name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="auth-label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
                minLength={6}
                placeholder="At least 6 characters"
              />
            </div>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create account'}
            </button>
          </form>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
      <div className="auth-pane auth-hero">
        <div className="auth-hero-content">
          <h2>Everything your team needs to collaborate.</h2>
          <p>Video meetings, persistent chat, and one simple home — built for your team.</p>
        </div>
      </div>
    </div>
  )
}
