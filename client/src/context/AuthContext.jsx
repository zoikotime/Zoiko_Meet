import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const token = localStorage.getItem('zoiko_token')
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const me = await api('/api/auth/me')
      setUser(me)
    } catch {
      localStorage.removeItem('zoiko_token')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = useCallback(async (email, password) => {
    const data = await api('/api/auth/login', {
      auth: false,
      form: { username: email, password },
    })
    localStorage.setItem('zoiko_token', data.access_token)
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(async (email, name, password) => {
    const data = await api('/api/auth/register', {
      method: 'POST',
      auth: false,
      body: { email, name, password },
    })
    localStorage.setItem('zoiko_token', data.access_token)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('zoiko_token')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
