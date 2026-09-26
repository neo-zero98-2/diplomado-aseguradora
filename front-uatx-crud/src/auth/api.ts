import type { LoginResponse } from './types.ts'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export class LoginError extends Error {}

export async function login(
  identificador: string,
  contrasena: string,
): Promise<LoginResponse> {
  let respuesta: Response
  try {
    respuesta = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador, contrasena }),
    })
  } catch {
    throw new LoginError('No se pudo conectar con el servidor')
  }

  if (respuesta.ok) {
    return (await respuesta.json()) as LoginResponse
  }
  if (respuesta.status === 403) {
    throw new LoginError('Tu contrato ha vencido')
  }
  if (respuesta.status === 401 || respuesta.status === 400) {
    throw new LoginError('Correo/idUsuario o contraseña incorrectos')
  }
  throw new LoginError('Ocurrió un error, inténtalo de nuevo')
}
