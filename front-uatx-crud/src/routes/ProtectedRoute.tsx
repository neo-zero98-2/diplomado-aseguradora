import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAppSelector } from '../store/index.ts'

// Solo renderiza su contenido si hay sesión; si no, redirige a /login
function ProtectedRoute({ children }: { children: ReactNode }) {
  const accessToken = useAppSelector((state) => state.auth.accessToken)

  if (!accessToken) {
    return <Navigate to="/login" replace />
  }
  return children
}

export default ProtectedRoute
