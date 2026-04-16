import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'
import './Layout.css'

const NAV = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/chat', label: 'Chat', icon: '💬' },
  { to: '/meet', label: 'Meet', icon: '📹' },
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
          <span>Zoiko Meet</span>
        </div>
        <nav className="side-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => 'side-nav-item' + (isActive ? ' active' : '')}
            >
              <span className="side-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="side-footer">
          {user && (
            <div className="side-user" title={user.email}>
              <Avatar name={user.name} color={user.avatar_color} size="sm" />
              <div className="side-user-info">
                <div className="side-user-name">{user.name}</div>
                <div className="side-user-email">{user.email}</div>
              </div>
              <button className="ghost side-user-logout" onClick={handleLogout} title="Sign out">
                ⎋
              </button>
            </div>
          )}
        </div>
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
