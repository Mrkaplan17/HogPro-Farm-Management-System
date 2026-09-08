import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('piggery_user') || 'null') } catch { return null }
  })
  const [token, setToken] = useState(() => localStorage.getItem('piggery_token'))

  useEffect(() => {
    if (token && !user) {
      api.me().then(setUser).catch(() => logout())
    }
  }, [token])

  const setSession = (token, user) => {
    localStorage.setItem('piggery_token', token)
    localStorage.setItem('piggery_user', JSON.stringify(user))
    setToken(token)
    setUser(user)
  }

  const login = async (email, password) => {
    const res = await api.login(email, password)
    setSession(res.access_token, res.user)
    return res.user
  }

  const logout = () => {
    localStorage.removeItem('piggery_token')
    localStorage.removeItem('piggery_user')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, setSession, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}