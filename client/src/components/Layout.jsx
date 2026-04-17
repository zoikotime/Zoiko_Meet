import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'
import Icon from './Icon'
import NotificationBell from './NotificationBell'
import './Layout.css'

const NAV = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/chat', label: 'Chat', icon: 'chat' },
  { to: '/meet', label: 'Meet', icon: 'video' },
  { to: '/dashboard', label: 'Dashboard', icon: 'chart' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand">
          <div className="brand-mark">Z</div>
          <div className="brand-text">
            <span className="brand-name">Zoiko</span>
            <span className="brand-sub">Meet</span>
          </div>
        </div>

        <nav className="side-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => 'side-nav-item' + (isActive ? ' active' : '')}
            >
              <span className="side-nav-indicator" aria-hidden="true" />
              <span className="side-nav-icon"><Icon name={item.icon} size={18} /></span>
              <span className="side-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="side-footer">
          {user && (
            <>
            <div className="side-notif-row">
              <NotificationBell />
            </div>
            <div className="side-user" title={user.email}>
              <div className="side-user-avatar">
                <Avatar name={user.name} color={user.avatar_color} size="sm" />
                <span className="presence-dot" />
              </div>
              <div className="side-user-info">
                <div className="side-user-name">{user.name}</div>
                <div className="side-user-email">{user.email}</div>
              </div>
              <button
                className="ghost side-user-logout"
                onClick={handleLogout}
                title="Sign out"
                aria-label="Sign out"
              >
                <Icon name="logout" size={16} />
              </button>
            </div>
            </>
          )}
        </div>
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
