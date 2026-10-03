import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { EstadoAccidente } from '../accidentes.types.js';

export const ESTADOS_ACCIDENTE: EstadoAccidente[] = [
  'pendiente',
  'en_revision',
  'aprobado',
  'rechazado',
];

// Body de PATCH /accidentes/:id: el asegurador solo cambia el estado y la nota.
// Al menos uno de los dos es obligatorio (lo verifica el servicio)
export class ActualizarAccidenteDto {
  @IsOptional()
  @IsIn(ESTADOS_ACCIDENTE)
  estado?: EstadoAccidente;

  // '' o null borran la nota
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notaAsegurador?: string | null;
}
