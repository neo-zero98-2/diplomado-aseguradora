import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { LoginResponse, Perfil } from '../auth/types.ts'

export const CLAVE_SESION = 'uatx-sesion'

export interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  perfil: Perfil | null
}

const estadoVacio: AuthState = {
  accessToken: null,
  refreshToken: null,
  perfil: null,
}

// Hidrata la sesión guardada en localStorage al iniciar la app
export function cargarSesion(): AuthState {
  try {
    const guardada = localStorage.getItem(CLAVE_SESION)
    if (!guardada) return estadoVacio
    const sesion = JSON.parse(guardada) as AuthState
    if (!sesion.accessToken || !sesion.perfil) return estadoVacio
    return sesion
  } catch {
    return estadoVacio
  }
}

const authSlice = createSlice({
  name: 'auth',
  initialState: cargarSesion,
  reducers: {
    iniciarSesion(_state, action: PayloadAction<LoginResponse>) {
      return action.payload
    },
    cerrarSesion() {
      return estadoVacio
    },
  },
})

export const { iniciarSesion, cerrarSesion } = authSlice.actions
export default authSlice.reducer
