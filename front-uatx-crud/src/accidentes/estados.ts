import type { ChipProps } from '@mui/material'
import type { EstadoAccidente, Gravedad } from './types.ts'

type ColorChip = ChipProps['color']

// En el orden del flujo de un siniestro; el selector de estado lo respeta
export const ESTADOS: EstadoAccidente[] = [
  'pendiente',
  'en_revision',
  'aprobado',
  'rechazado',
]

export const ETIQUETA_ESTADO: Record<EstadoAccidente, string> = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
}

export const COLOR_ESTADO: Record<EstadoAccidente, ColorChip> = {
  pendiente: 'warning',
  en_revision: 'info',
  aprobado: 'success',
  rechazado: 'error',
}

export const ETIQUETA_GRAVEDAD: Record<Gravedad, string> = {
  leve: 'Leve',
  moderado: 'Moderado',
  grave: 'Grave',
}

export const COLOR_GRAVEDAD: Record<Gravedad, ColorChip> = {
  leve: 'default',
  moderado: 'warning',
  grave: 'error',
}
