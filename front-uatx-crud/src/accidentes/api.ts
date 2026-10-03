import { peticion } from '../api/peticion.ts'
import type {
  AccidenteCreado,
  AnalisisFoto,
  CrearAccidenteDto,
  MensajeChat,
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
