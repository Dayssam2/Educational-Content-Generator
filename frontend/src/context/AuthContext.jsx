import { createContext, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken, ApiError } from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // "loading" couvre uniquement la verification du token au demarrage de
  // l'appli, pas les appels login/signup individuels (voir plus bas).
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

  // "Continuer avec Google" -- meme forme que login()/signup() ci-dessus :
  // le backend renvoie {token, user} qu'on stocke pareil, qu'un compte ait
  // ete cree ou qu'une session existante ait juste ete retrouvee. genre
  // n'est utile que pour un nouveau compte (voir client.js / backend).
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
      // le jeton est peut-etre deja expire cote serveur -- on nettoie quand meme localement
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