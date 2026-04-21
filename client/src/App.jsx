import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import UpdateToast from './components/UpdateToast.jsx'
import CallOverlay from './components/CallOverlay.jsx'
import { useAuth } from './context/AuthContext.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Home from './pages/Home.jsx'
import Chat from './pages/Chat.jsx'
import Meet from './pages/Meet.jsx'
import MeetLobby from './pages/MeetLobby.jsx'
import MeetRoom from './pages/MeetRoom.jsx'
import Dashboard from './pages/Dashboard.jsx'
import OrgSettings from './pages/OrgSettings.jsx'
import Admin from './pages/Admin.jsx'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
        <div className="spinner" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <>
    <UpdateToast />
    <CallOverlay />
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <Login />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/register"
        element={
          <RedirectIfAuthed>
            <Register />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/meet/:code"
        element={
          <RequireAuth>
            <MeetLobby />
          </RequireAuth>
        }
      />
      <Route
        path="/meet/:code/room"
        element={
          <RequireAuth>
            <MeetRoom />
          </RequireAuth>
        }
      />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/chat/:channelId" element={<Chat />} />
        <Route path="/meet" element={<Meet />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/org/:slug" element={<OrgSettings />} />
        <Route path="/admin" element={<Admin />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}
