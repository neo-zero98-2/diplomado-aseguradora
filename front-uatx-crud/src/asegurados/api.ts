import type {
  ActualizarAseguradoDto,
  Asegurado,
  CrearAseguradoDto,
} from './types.ts'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// Un 401: el access token es inválido o expiró; el llamador cierra la sesión
export class SesionExpiradaError extends Error {
  constructor() {
    super('Tu sesión expiró')
  }
}

// Cualquier otra respuesta de error, con el mensaje listo para mostrar
export class AseguradosError extends Error {
  readonly status: number

  constructor(status: number, mensaje: string) {
    super(mensaje)
    this.status = status
  }
}

async function peticion<T>(
  token: string,
  metodo: string,
  ruta: string,
  body?: unknown,
): Promise<T> {
  let respuesta: Response
  try {
    respuesta = await fetch(`${API_URL}/asegurados${ruta}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new AseguradosError(0, 'No se pudo conectar con el servidor')
  }

  if (respuesta.status === 401) {
    throw new SesionExpiradaError()
  }
  if (!respuesta.ok) {
    throw new AseguradosError(respuesta.status, await mensajeDe(respuesta))
  }
  if (respuesta.status === 204) {
    return undefined as T
  }
  return (await respuesta.json()) as T
}

// NestJS responde { message: string | string[] }; class-validator usa arreglo
async function mensajeDe(respuesta: Response): Promise<string> {
  try {
    const { message } = (await respuesta.json()) as {
      message?: string | string[]
    }
    if (Array.isArray(message)) return message.join('. ')
    if (message) return message
  } catch {
    // Respuesta sin JSON: se usa el mensaje genérico
  }
  return 'Ocurrió un error, inténtalo de nuevo'
}

export function listar(token: string) {
  return peticion<Asegurado[]>(token, 'GET', '')
}

export function crear(token: string, dto: CrearAseguradoDto) {
  return peticion<Asegurado>(token, 'POST', '', dto)
}

export function actualizar(
  token: string,
  id: string,
  dto: ActualizarAseguradoDto,
) {
  return peticion<Asegurado>(token, 'PATCH', `/${id}`, dto)
}

export function eliminar(token: string, id: string) {
  return peticion<void>(token, 'DELETE', `/${id}`)
}
