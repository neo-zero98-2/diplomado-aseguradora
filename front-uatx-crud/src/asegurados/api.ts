import { peticion } from '../api/peticion.ts'
import type {
  ActualizarAseguradoDto,
  Asegurado,
  CrearAseguradoDto,
} from './types.ts'

export function listar(token: string) {
  return peticion<Asegurado[]>(token, 'GET', '/asegurados')
}

export function crear(token: string, dto: CrearAseguradoDto) {
  return peticion<Asegurado>(token, 'POST', '/asegurados', dto)
}

export function actualizar(
  token: string,
  id: string,
  dto: ActualizarAseguradoDto,
) {
  return peticion<Asegurado>(token, 'PATCH', `/asegurados/${id}`, dto)
}

export function eliminar(token: string, id: string) {
  return peticion<void>(token, 'DELETE', `/asegurados/${id}`)
}
