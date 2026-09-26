import { configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector } from 'react-redux'
import authReducer, { CLAVE_SESION, type AuthState } from './authSlice.ts'

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
})

// Persiste la sesión en localStorage cada vez que cambia
let sesionAnterior: AuthState = store.getState().auth
store.subscribe(() => {
  const sesion = store.getState().auth
  if (sesion === sesionAnterior) return
  sesionAnterior = sesion
  try {
    if (sesion.accessToken) {
      localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion))
    } else {
      localStorage.removeItem(CLAVE_SESION)
    }
  } catch {
    // localStorage no disponible: la sesión queda solo en memoria
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
