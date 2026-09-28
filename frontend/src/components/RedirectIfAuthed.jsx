import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Inverse de RequireAuth : utilise sur les pages publiques (Accueil, Login,
// Signup). Si l'utilisateur est deja connecte, on ne lui remontre pas la
// vitrine / le formulaire -- on l'envoie direct dans son espace de travail.
export default function RedirectIfAuthed({ to = '/wizard/selection', children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6eeec] text-sm text-[#4f0005]/50">
        Chargement...
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to={to} replace />
  }

  return children
}
