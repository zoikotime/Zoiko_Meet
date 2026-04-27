import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getApiBase } from '../api/client'
import { useAuth } from '../context/AuthContext'
import Icon from '../components/Icon'
import './Dashboard.css'

function formatDuration(mins) {
  if (!mins) return '0m'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [history, setHistory] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api('/api/dashboard/stats'),
      api('/api/dashboard/history?limit=20'),
      api('/api/dashboard/upcoming'),
    ])
      .then(([s, h, u]) => {
        setStats(s)
        setHistory(h)
        setUpcoming(u)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const loadMore = async () => {
    const nextPage = page + 1
    try {
      const more = await api(`/api/dashboard/history?page=${nextPage}&limit=20`)
      setHistory(prev => [...prev, ...more])
      setPage(nextPage)
    } catch {}
  }

  const downloadCalendar = async (code) => {
    try {
      const token = localStorage.getItem('zoiko_token')
      const res = await fetch(`${getApiBase()}/api/meetings/${code}/calendar`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'meeting.ics'
      a.click()
    } catch {}
  }

  if (loading) {
    return (
      <div className="dashboard">
        <div style={{ display: 'grid', placeItems: 'center', padding: 80 }}>
          <div className="spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <header className="dash-hero">
        <div className="dash-hero-top">
          <span className="badge accent">
            <Icon name="chart" size={12} />
            <span>Dashboard</span>
          </span>
        </div>
        <h1 className="dash-hero-title">Your meeting analytics</h1>
        <p className="dash-hero-sub">Track your meeting history, stats, and upcoming events.</p>
      </header>

      {/* Stats cards */}
      {stats && (
        <div className="dash-stats">
          <div className="dash-stat-card">
            <div className="dash-stat-icon"><Icon name="video" size={20} /></div>
            <div className="dash-stat-value">{stats.total_meetings}</div>
            <div className="dash-stat-label">Total meetings</div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-icon accent"><Icon name="trendUp" size={20} /></div>
            <div className="dash-stat-value">{stats.meetings_this_week}</div>
            <div className="dash-stat-label">This week</div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-icon"><Icon name="calendar" size={20} /></div>
            <div className="dash-stat-value">{stats.meetings_this_month}</div>
            <div className="dash-stat-label">This month</div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-icon"><Icon name="users" size={20} /></div>
            <div className="dash-stat-value">{stats.total_participants}</div>
            <div className="dash-stat-label">Participants hosted</div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-icon"><Icon name="clock" size={20} /></div>
            <div className="dash-stat-value">{formatDuration(stats.total_duration_minutes)}</div>
            <div className="dash-stat-label">Time in meetings</div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-icon"><Icon name="record" size={20} /></div>
            <div className="dash-stat-value">{stats.total_recordings}</div>
            <div className="dash-stat-label">Recordings</div>
          </div>
        </div>
      )}

      {/* Upcoming meetings */}
      {upcoming.length > 0 && (
        <section className="dash-section">
          <div className="dash-section-head">
            <div className="dash-section-title">
              <Icon name="calendarPlus" size={16} />
              Upcoming meetings
            </div>
          </div>
          <div className="dash-upcoming">
            {upcoming.map(m => (
              <div key={m.id} className="dash-upcoming-item">
                <div className="dash-upcoming-date">
                  <div className="dash-upcoming-day">{new Date(m.scheduled_at).getDate()}</div>
                  <div className="dash-upcoming-month">{new Date(m.scheduled_at).toLocaleString([], { month: 'short' })}</div>
                </div>
                <div className="dash-upcoming-body">
                  <div className="dash-upcoming-title">{m.title}</div>
                  <div className="dash-upcoming-time">
                    <Icon name="clock" size={12} />
                    {formatTime(m.scheduled_at)}
                    {m.timezone_name && <span className="dash-upcoming-tz">{m.timezone_name}</span>}
                  </div>
                </div>
                <div className="dash-upcoming-actions">
                  <button className="outline sm" onClick={() => navigate(`/meet/${m.code}`)}>
                    Join
                  </button>
                  <button className="ghost sm" onClick={() => downloadCalendar(m.code)} title="Add to calendar">
                    <Icon name="download" size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Meeting history */}
      <section className="dash-section">
        <div className="dash-section-head">
          <div className="dash-section-title">
            <Icon name="clock" size={16} />
            Meeting history
          </div>
        </div>

        {history.length === 0 ? (
          <div className="home-empty">
            <div className="home-empty-icon"><Icon name="video" size={24} /></div>
            <div>
              <div className="home-empty-title">No meetings yet</div>
              <div className="home-empty-sub">Start or join a meeting to build your history.</div>
            </div>
          </div>
        ) : (
          <>
            <div className="dash-history">
              <div className="dash-history-header">
                <span>Meeting</span>
                <span>Host</span>
                <span>Participants</span>
                <span>Duration</span>
                <span>Date</span>
                <span>Status</span>
              </div>
              {history.map(m => (
                <button
                  key={m.id}
                  className="dash-history-row"
                  onClick={() => navigate(`/meet/${m.code}`)}
                >
                  <span className="dash-history-cell">
                    <div className="dash-history-title">{m.title}</div>
                    <div className="dash-history-code mono">{m.code}</div>
                  </span>
                  <span className="dash-history-cell">
                    {m.host_name || 'Unknown'}
                    {m.host_id === user?.id && <span className="badge sm">You</span>}
                  </span>
                  <span className="dash-history-cell">{m.participant_count}</span>
                  <span className="dash-history-cell">{m.duration_minutes != null ? formatDuration(m.duration_minutes) : '—'}</span>
                  <span className="dash-history-cell">{formatDate(m.created_at)}</span>
                  <span className="dash-history-cell">
                    <span className={'badge sm ' + (m.is_active ? 'live' : 'muted')}>{m.is_active ? 'Active' : 'Ended'}</span>
                  </span>
                </button>
              ))}
            </div>
            {history.length >= page * 20 && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <button className="outline" onClick={loadMore}>Load more</button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
