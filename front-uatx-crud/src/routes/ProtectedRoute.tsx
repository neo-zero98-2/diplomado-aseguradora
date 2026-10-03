import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { Perfil } from '../auth/types.ts'
import { useAppSelector } from '../store/index.ts'

interface ProtectedRouteProps {
  children: ReactNode
  // Si se indica, solo ese rol puede entrar; los demás vuelven a /home
  rol?: Perfil['rol']
}

// Solo renderiza su contenido si hay sesión; si no, redirige a /login
function ProtectedRoute({ children, rol }: ProtectedRouteProps) {
  const accessToken = useAppSelector((state) => state.auth.accessToken)
  const perfil = useAppSelector((state) => state.auth.perfil)

  if (!accessToken) {
    return <Navigate to="/login" replace />
  }
  if (rol && perfil?.rol !== rol) {
    return <Navigate to="/home" replace />
  }
  return children
}

export default ProtectedRoute
