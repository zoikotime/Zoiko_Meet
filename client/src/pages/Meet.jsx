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

function formatScheduled(iso, tz) {
  try {
    const d = new Date(iso)
    const now = new Date()
    const opts = { dateStyle: 'medium', timeStyle: 'short' }
    if (tz) opts.timeZone = tz
    const formatted = d.toLocaleString([], opts)
    const isPast = d < now
    return { formatted, isPast }
  } catch {
    return { formatted: '', isPast: false }
  }
}

export default function Meet() {
  const navigate = useNavigate()
  const [recent, setRecent] = useState([])
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // Schedule form state
  const [showSchedule, setShowSchedule] = useState(false)
  const [schedTitle, setSchedTitle] = useState('')
  const [schedDate, setSchedDate] = useState('')
  const [schedTime, setSchedTime] = useState('')
  const [schedTz, setSchedTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [schedWaiting, setSchedWaiting] = useState(true)
  const [scheduling, setScheduling] = useState(false)

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

  const scheduleMeeting = async (e) => {
    e.preventDefault()
    if (!schedDate || !schedTime) return
    setScheduling(true)
    setErr('')
    try {
      const scheduledAt = new Date(`${schedDate}T${schedTime}`).toISOString()
      const meeting = await api('/api/meetings', {
        method: 'POST',
        body: {
          title: schedTitle || 'Scheduled meeting',
          scheduled_at: scheduledAt,
          timezone_name: schedTz || null,
          waiting_room_enabled: schedWaiting,
        },
      })
      // Reset form
      setShowSchedule(false)
      setSchedTitle('')
      setSchedDate('')
      setSchedTime('')
      setSchedWaiting(true)
      // Add to recent list
      setRecent((prev) => [meeting, ...prev])
    } catch (e) {
      setErr(e.message)
    } finally {
      setScheduling(false)
    }
  }

  // Common timezone list
  const tzOptions = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Sao_Paulo',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Moscow',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Shanghai',
    'Asia/Tokyo',
    'Australia/Sydney',
    'Pacific/Auckland',
  ]
  // Ensure user's TZ is included
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (!tzOptions.includes(userTz)) tzOptions.unshift(userTz)

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
            <button className="outline" onClick={() => setShowSchedule(true)}>
              <Icon name="calendar" size={14} /> Schedule meeting
            </button>
          </div>
        </article>
      </div>

      {/* Schedule meeting modal */}
      {showSchedule && (
        <div className="schedule-overlay" onClick={() => setShowSchedule(false)}>
          <div className="schedule-modal" onClick={(e) => e.stopPropagation()}>
            <div className="schedule-modal-head">
              <h2>Schedule a meeting</h2>
              <button className="ghost" onClick={() => setShowSchedule(false)}>
                <Icon name="close" size={18} />
              </button>
            </div>
            <form onSubmit={scheduleMeeting} className="schedule-form">
              <label className="schedule-field">
                <span>Title</span>
                <input
                  placeholder="Scheduled meeting"
                  value={schedTitle}
                  onChange={(e) => setSchedTitle(e.target.value)}
                  maxLength={200}
                />
              </label>
              <div className="schedule-row">
                <label className="schedule-field">
                  <span>Date</span>
                  <input
                    type="date"
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    required
                    min={new Date().toISOString().split('T')[0]}
                  />
                </label>
                <label className="schedule-field">
                  <span>Time</span>
                  <input
                    type="time"
                    value={schedTime}
                    onChange={(e) => setSchedTime(e.target.value)}
                    required
                  />
                </label>
              </div>
              <label className="schedule-field">
                <span>Timezone</span>
                <select value={schedTz} onChange={(e) => setSchedTz(e.target.value)}>
                  {tzOptions.map((tz) => (
                    <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </label>
              <label className="schedule-toggle">
                <input
                  type="checkbox"
                  checked={schedWaiting}
                  onChange={(e) => setSchedWaiting(e.target.checked)}
                />
                <span>Enable waiting room</span>
              </label>
              <div className="schedule-actions">
                <button type="button" className="outline" onClick={() => setShowSchedule(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary" disabled={scheduling || !schedDate || !schedTime}>
                  {scheduling ? (
                    <><span className="spinner" style={{ width: 14, height: 14 }} /> Scheduling…</>
                  ) : (
                    <><Icon name="calendar" size={14} /> Schedule</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            {recent.map((m) => {
              const sched = m.scheduled_at ? formatScheduled(m.scheduled_at, m.timezone_name) : null
              return (
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
                    ) : sched ? (
                      <span className={'badge' + (sched.isPast ? '' : ' accent')}>
                        <Icon name="calendar" size={11} /> {sched.formatted}
                      </span>
                    ) : (
                      <><Icon name="clock" size={13} /> <span>{formatWhen(m.created_at)}</span></>
                    )}
                  </div>
                  <div className="home-recent-chev">
                    <Icon name="arrowLeft" size={16} style={{ transform: 'rotate(180deg)' }} />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
