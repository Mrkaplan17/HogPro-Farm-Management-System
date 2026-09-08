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

  const login = async (username, password) => {
    const res = await api.login(username, password)
    localStorage.setItem('piggery_token', res.access_token)
    localStorage.setItem('piggery_user', JSON.stringify(res.user))
    setToken(res.access_token)
    setUser(res.user)
    return res.user
  }

  const logout = () => {
    localStorage.removeItem('piggery_token')
    localStorage.removeItem('piggery_user')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}