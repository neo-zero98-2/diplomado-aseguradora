// Contratos de /asegurados (ver specs/02-pantalla-inicio-y-crud-asegurados.md)
export interface Asegurado {
  id: string
  nombre: string
  edad: number
  idContrato: string
  fechaVencimiento: string // 'YYYY-MM-DD'
  fechaRegistro: string // 'YYYY-MM-DD', solo lectura
  correo: string
}

export interface CrearAseguradoDto {
  nombre: string
  edad: number
  idContrato: string
  fechaVencimiento: string
  correo: string
  contrasena: string
}

export type ActualizarAseguradoDto = Partial<
  Omit<CrearAseguradoDto, 'contrasena'>
>
