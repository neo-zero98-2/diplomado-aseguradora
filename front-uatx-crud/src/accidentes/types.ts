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
