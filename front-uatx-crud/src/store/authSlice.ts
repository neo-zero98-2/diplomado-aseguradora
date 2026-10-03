import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { LoginResponse, Perfil } from '../auth/types.ts'

export const CLAVE_SESION = 'uatx-sesion'

export interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  perfil: Perfil | null
  // Mensaje para /login al cerrar la sesión por un motivo (p. ej. "Tu sesión expiró")
  avisoLogin: string | null
}

const estadoVacio: AuthState = {
  accessToken: null,
  refreshToken: null,
  perfil: null,
  avisoLogin: null,
}

// Hidrata la sesión guardada en localStorage al iniciar la app
export function cargarSesion(): AuthState {
  try {
    const guardada = localStorage.getItem(CLAVE_SESION)
    if (!guardada) return estadoVacio
    const sesion = JSON.parse(guardada) as AuthState
    if (!sesion.accessToken || !sesion.perfil) return estadoVacio
    return { ...sesion, avisoLogin: null }
  } catch {
    return estadoVacio
  }
}

const authSlice = createSlice({
  name: 'auth',
  initialState: cargarSesion,
  reducers: {
    iniciarSesion(_state, action: PayloadAction<LoginResponse>) {
      return { ...action.payload, avisoLogin: null }
    },
    // El aviso viaja en el store y no en el state de la navegación: al vaciarse
    // la sesión, ProtectedRoute redirige a /login antes que cualquier navigate
    cerrarSesion(_state, action: PayloadAction<string | undefined>) {
      return { ...estadoVacio, avisoLogin: action.payload ?? null }
    },
  },
})

export const { iniciarSesion, cerrarSesion } = authSlice.actions
export default authSlice.reducer
