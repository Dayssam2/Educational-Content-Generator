import { createContext, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken, ApiError } from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setLoading(false)
      return
    }
    api
      .me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  async function login({ email, password }) {
    const data = await api.login({ email, password })
    setToken(data.token)
    setUser(data.user)
    return data.user
  }

  async function signup({ email, password, nom, genre }) {
    const data = await api.signup({ email, password, nom, genre })
    setToken(data.token)
    setUser(data.user)
    return data.user
  }

  async function loginWithGoogle({ accessToken, genre }) {
    const data = await api.google({ accessToken, genre })
    setToken(data.token)
    setUser(data.user)
    return data.user
  }

  async function logout() {
    try {
      await api.logout()
    } catch {
    }
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, signup, loginWithGoogle, logout, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit etre utilise a l\'interieur de <AuthProvider>')
  return ctx
}

export { ApiError }