// Contratos de la API de accidentes (back-uatx-crud/src/accidentes)

export type Gravedad = 'leve' | 'moderado' | 'grave'

// Respuesta de POST /accidentes/foto; no guarda nada
export type AnalisisFoto =
  | {
      procede: true
      descripcion: string
      gravedad: Gravedad
      constancia: string
    }
  | { procede: false; mensaje: string }

export interface MensajeChat {
  rol: 'usuario' | 'asistente'
  texto: string
}

// Datos que reúne la entrevista
export interface DatosAccidente {
  aseguradoBien: boolean
  fechaHoraAccidente: string // ISO 8601
  resumen: string
  direccion?: string // si no hubo GPS
  vehiculoMarca: string
  vehiculoModelo: string
  vehiculoPlacas: string
  hayTerceros: boolean
  tercerosDescripcion?: string
}

export type EtapaChat = 'entrevista' | 'confirmacion'

// Respuesta de POST /accidentes/chat
export interface RespuestaChat {
  mensaje: string
  etapa: EtapaChat // 'confirmacion' solo cuando ya están todos los datos
  sugerir911: boolean
  datos: Partial<DatosAccidente>
}

// Campo "datos" de POST /accidentes
export interface CrearAccidenteDto extends DatosAccidente {
  latitud?: number
  longitud?: number
}

// Respuesta de POST /accidentes
export interface AccidenteCreado {
  id: string
  estado: 'pendiente'
}

export type EstadoAccidente =
  | 'pendiente'
  | 'en_revision'
  | 'aprobado'
  | 'rechazado'

// Elemento de GET /accidentes (asegurador) y respuesta de PATCH /accidentes/:id
export interface AccidenteAsegurador {
  id: string
  estado: EstadoAccidente
  fechaHoraAccidente: string // ISO 8601
  fechaReporte: string // ISO 8601
  resumen: string
  aseguradoBien: boolean
  latitud: number | null
  longitud: number | null
  direccion: string | null
  vehiculoMarca: string
  vehiculoModelo: string
  vehiculoPlacas: string
  hayTerceros: boolean
  tercerosDescripcion: string | null
  fotoDescripcion: string
  gravedad: Gravedad
  notaAsegurador: string | null
  fechaActualizacion: string | null
  actualizadoPor: { id: string; nombre: string } | null
  asegurado: {
    id: string
    nombre: string
    idContrato: string
    correo: string
    fechaVencimiento: string // 'YYYY-MM-DD'
  }
}

// Respuesta de GET /accidentes/:id/foto
export interface FotoAccidente {
  url: string // URL firmada de Storage, válida 10 minutos
}

// Body de PATCH /accidentes/:id (al menos uno de los dos)
export interface ActualizarAccidenteDto {
  estado?: EstadoAccidente
  notaAsegurador?: string | null // '' o null borran la nota
}

// Elemento de GET /accidentes/mios (asegurado)
export interface MiAccidente {
  id: string
  fechaHoraAccidente: string
  vehiculoMarca: string
  vehiculoModelo: string
  vehiculoPlacas: string
  gravedad: Gravedad
  estado: EstadoAccidente
  notaAsegurador: string | null
}
