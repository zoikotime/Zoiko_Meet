import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getApiBase } from '../api/client'
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
  const [recordings, setRecordings] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [showMeetOptions, setShowMeetOptions] = useState(false)
  const [meetPassword, setMeetPassword] = useState('')
  // Schedule modal
  const [showSchedule, setShowSchedule] = useState(false)
  const [schedTitle, setSchedTitle] = useState('')
  const [schedDate, setSchedDate] = useState('')
  const [schedTime, setSchedTime] = useState('')
  const [schedTz, setSchedTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [schedWaiting, setSchedWaiting] = useState(true)
  const [schedPassword, setSchedPassword] = useState('')
  const [schedInvites, setSchedInvites] = useState('')
  const [scheduling, setScheduling] = useState(false)

  useEffect(() => {
    api('/api/meetings/recent').then(setRecent).catch(() => {})
    api('/api/recordings').then(setRecordings).catch(() => {})
  }, [])

  const startInstant = async () => {
    setBusy(true)
    setErr('')
    try {
      const body = { title: 'Instant meeting' }
      if (meetPassword.trim()) body.password = meetPassword.trim()
      const meeting = await api('/api/meetings', {
        method: 'POST',
        body,
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

  const scheduleMeeting = async () => {
    if (!schedTitle.trim() || !schedDate || !schedTime) return
    setScheduling(true)
    setErr('')
    try {
      const scheduledAt = new Date(`${schedDate}T${schedTime}`).toISOString()
      const body = {
        title: schedTitle.trim(),
        scheduled_at: scheduledAt,
        timezone_name: schedTz,
        waiting_room_enabled: schedWaiting,
      }
      if (schedPassword.trim()) body.password = schedPassword.trim()
      const meeting = await api('/api/meetings', { method: 'POST', body })

      // Send invites if emails provided
      const emails = schedInvites.split(/[,;\s]+/).filter(e => e.includes('@'))
      if (emails.length > 0) {
        await api(`/api/meetings/${meeting.code}/invite`, {
          method: 'POST',
          body: { emails },
        }).catch(() => {})
      }

      setShowSchedule(false)
      setSchedTitle('')
      setSchedDate('')
      setSchedTime('')
      setSchedPassword('')
      setSchedInvites('')
      setRecent(prev => [meeting, ...prev])
    } catch (e) {
      setErr(e.message)
    } finally {
      setScheduling(false)
    }
  }

  const deleteRecording = async (id) => {
    if (!window.confirm('Delete this recording?')) return
    try {
      await api(`/api/recordings/${id}`, { method: 'DELETE' })
      setRecordings(prev => prev.filter(r => r.id !== id))
    } catch {}
  }

  const shareRecording = async (id) => {
    try {
      const rec = await api(`/api/recordings/${id}/share`, { method: 'POST' })
      setRecordings(prev => prev.map(r => r.id === id ? { ...r, share_token: rec.share_token } : r))
      const shareUrl = `${window.location.origin}/recording/${rec.share_token}`
      await navigator.clipboard.writeText(shareUrl)
    } catch {}
  }

  const downloadRecording = (rec) => {
    const a = document.createElement('a')
    a.href = `${getApiBase()}${rec.file_url}`
    a.download = rec.file_name
    a.click()
  }

  const formatDuration = (secs) => {
    if (!secs) return '0:00'
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const formatSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
          {showMeetOptions && (
            <div className="home-card-password">
              <Icon name="lock" size={13} />
              <input
                type="password"
                placeholder="Optional meeting password"
                value={meetPassword}
                onChange={(e) => setMeetPassword(e.target.value)}
                autoComplete="off"
              />
            </div>
          )}
          <div className="home-card-actions">
            <button className="primary lg" onClick={startInstant} disabled={busy}>
              {busy ? (
                <><span className="spinner" style={{ width: 16, height: 16 }} /> Starting…</>
              ) : (
                <><Icon name="bolt" size={16} /> Start instant meeting</>
              )}
            </button>
            <button
              className="outline"
              onClick={() => setShowMeetOptions(!showMeetOptions)}
              title="Meeting security options"
            >
              <Icon name="lock" size={14} />
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

        <article className="home-card">
          <div className="home-card-head">
            <div className="home-card-icon">
              <Icon name="calendarPlus" size={22} />
            </div>
          </div>
          <h3>Schedule</h3>
          <p>Plan a meeting for later and send invites.</p>
          <div className="home-card-actions">
            <button onClick={() => setShowSchedule(true)} className="outline">
              <Icon name="calendar" size={14} /> Schedule meeting
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
                  <div className="home-recent-code mono">
                    {m.password_protected && <Icon name="lock" size={11} style={{ marginRight: 4 }} />}
                    {m.code}
                  </div>
                </div>
                <div className="home-recent-meta">
                  {m.scheduled_at ? (
                    <>
                      <Icon name="calendar" size={13} />
                      <span>{new Date(m.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </>
                  ) : (
                    <>
                      <Icon name="clock" size={13} />
                      <span>{formatWhen(m.created_at)}</span>
                    </>
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

      <section className="home-section">
        <div className="home-section-head">
          <div>
            <div className="home-section-title">Recordings</div>
            <div className="home-section-sub">Your saved meeting recordings — download or share.</div>
          </div>
        </div>
        {recordings.length === 0 ? (
          <div className="home-empty">
            <div className="home-empty-icon"><Icon name="record" size={24} /></div>
            <div>
              <div className="home-empty-title">No recordings yet</div>
              <div className="home-empty-sub">Record a meeting to see it here.</div>
            </div>
          </div>
        ) : (
          <div className="home-recordings">
            {recordings.map((rec) => (
              <div key={rec.id} className="home-rec-item">
                <div className="home-rec-icon">
                  <Icon name="record" size={18} />
                </div>
                <div className="home-rec-body">
                  <div className="home-rec-title">{rec.meeting_title || 'Untitled meeting'}</div>
                  <div className="home-rec-meta-row">
                    <span className="home-rec-code mono">{rec.meeting_code}</span>
                    <span className="home-rec-sep" />
                    <span>{formatDuration(rec.duration)}</span>
                    <span className="home-rec-sep" />
                    <span>{formatSize(rec.file_size)}</span>
                    {rec.includes_chat && (
                      <>
                        <span className="home-rec-sep" />
                        <span className="home-rec-chat-tag"><Icon name="chat" size={11} /> Chat log</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="home-rec-date">
                  <Icon name="clock" size={13} />
                  <span>{formatWhen(rec.created_at)}</span>
                </div>
                <div className="home-rec-actions">
                  <button className="home-rec-action" onClick={() => downloadRecording(rec)} title="Download">
                    <Icon name="download" size={15} />
                  </button>
                  <button className="home-rec-action" onClick={() => shareRecording(rec.id)} title={rec.share_token ? 'Copy share link' : 'Create share link'}>
                    <Icon name="share" size={15} />
                  </button>
                  <button className="home-rec-action danger" onClick={() => deleteRecording(rec.id)} title="Delete">
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Schedule modal */}
      {showSchedule && (
        <div className="schedule-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowSchedule(false) }}>
          <div className="schedule-modal">
            <div className="schedule-modal-head">
              <h2>Schedule a meeting</h2>
              <button className="ghost" onClick={() => setShowSchedule(false)}>
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="schedule-form">
              <div className="schedule-field">
                <span>Meeting title</span>
                <input
                  placeholder="Team standup"
                  value={schedTitle}
                  onChange={(e) => setSchedTitle(e.target.value)}
                />
              </div>
              <div className="schedule-row">
                <div className="schedule-field">
                  <span>Date</span>
                  <input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} />
                </div>
                <div className="schedule-field">
                  <span>Time</span>
                  <input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} />
                </div>
              </div>
              <div className="schedule-field">
                <span>Timezone</span>
                <select value={schedTz} onChange={(e) => setSchedTz(e.target.value)}>
                  {['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Europe/London','Europe/Paris','Europe/Berlin','Asia/Kolkata','Asia/Tokyo','Asia/Shanghai','Australia/Sydney','Pacific/Auckland'].map(tz => (
                    <option key={tz} value={tz}>{tz.replace(/_/g,' ')}</option>
                  ))}
                </select>
              </div>
              <div className="schedule-field">
                <span>Invite people (emails, comma-separated)</span>
                <input
                  placeholder="alice@example.com, bob@example.com"
                  value={schedInvites}
                  onChange={(e) => setSchedInvites(e.target.value)}
                />
              </div>
              <div className="schedule-field">
                <span>Password (optional)</span>
                <input
                  type="password"
                  placeholder="Leave blank for no password"
                  value={schedPassword}
                  onChange={(e) => setSchedPassword(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <label className="schedule-toggle">
                <input
                  type="checkbox"
                  checked={schedWaiting}
                  onChange={(e) => setSchedWaiting(e.target.checked)}
                />
                Enable waiting room
              </label>
              <div className="schedule-actions">
                <button className="outline" onClick={() => setShowSchedule(false)}>Cancel</button>
                <button
                  className="primary"
                  onClick={scheduleMeeting}
                  disabled={scheduling || !schedTitle.trim() || !schedDate || !schedTime}
                >
                  {scheduling ? (
                    <><span className="spinner" style={{ width: 14, height: 14 }} /> Scheduling…</>
                  ) : (
                    <><Icon name="calendar" size={14} /> Schedule</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
