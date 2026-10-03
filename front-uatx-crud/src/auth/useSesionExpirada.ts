import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { SesionExpiradaError } from '../asegurados/api.ts'
import { useAppDispatch } from '../store/index.ts'
import { cerrarSesion } from '../store/authSlice.ts'

// Devuelve un manejador de errores: si el error es un 401, cierra la sesión con
// el aviso "Tu sesión expiró", lleva a /login y responde true; si no, responde false
export function useSesionExpirada() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  return useCallback(
    (error: unknown) => {
      if (!(error instanceof SesionExpiradaError)) return false
      dispatch(cerrarSesion(error.message))
      navigate('/login', { replace: true })
      return true
    },
    [dispatch, navigate],
  )
}
