import { peticion } from '../api/peticion.ts'
import type {
  AccidenteAsegurador,
  AccidenteCreado,
  ActualizarAccidenteDto,
  AnalisisFoto,
  CrearAccidenteDto,
  FotoAccidente,
  MensajeChat,
  MiAccidente,
  RespuestaChat,
} from './types.ts'

// Gemini analiza la foto; si procede, devuelve la constancia para crearAccidente
export function analizarFoto(token: string, foto: File) {
  const formulario = new FormData()
  formulario.append('foto', foto)
  return peticion<AnalisisFoto>(token, 'POST', '/accidentes/foto', formulario)
}

// Un turno de la entrevista: se manda el historial completo
export function conversar(token: string, mensajes: MensajeChat[]) {
  return peticion<RespuestaChat>(token, 'POST', '/accidentes/chat', {
    mensajes,
  })
}

// La foto debe ser el mismo archivo que se analizó con analizarFoto
export function crearAccidente(
  token: string,
  foto: File,
  constancia: string,
  datos: CrearAccidenteDto,
) {
  const formulario = new FormData()
  formulario.append('foto', foto)
  formulario.append('constancia', constancia)
  formulario.append('datos', JSON.stringify(datos))
  return peticion<AccidenteCreado>(token, 'POST', '/accidentes', formulario)
}

// Asegurador: todos los accidentes con los datos de su asegurado
export function listarAccidentes(token: string) {
  return peticion<AccidenteAsegurador[]>(token, 'GET', '/accidentes')
}

// Asegurador: URL firmada de la foto, válida 10 minutos
export function obtenerFotoAccidente(token: string, id: string) {
  return peticion<FotoAccidente>(token, 'GET', `/accidentes/${id}/foto`)
}

// Asegurador: cambia el estado y/o la nota
export function actualizarAccidente(
  token: string,
  id: string,
  dto: ActualizarAccidenteDto,
) {
  return peticion<AccidenteAsegurador>(
    token,
    'PATCH',
    `/accidentes/${id}`,
    dto,
  )
}

// Asegurador: borra el accidente y su foto
export function eliminarAccidente(token: string, id: string) {
  return peticion<void>(token, 'DELETE', `/accidentes/${id}`)
}

// Asegurado: solo sus accidentes
export function listarMisAccidentes(token: string) {
  return peticion<MiAccidente[]>(token, 'GET', '/accidentes/mios')
}
