// Contrato de POST /auth/login (ver specs/01-auth-y-modelo-usuarios.md)
export interface PerfilAsegurado {
  rol: 'asegurado'
  nombre: string
  edad: number
  idContrato: string
  fechaVencimiento: string
  fechaRegistro: string
  correo: string
}

export interface PerfilAsegurador {
  rol: 'asegurador'
  nombre: string
  edad: number
  idEmpleado: string
  correo: string
}

export type Perfil = PerfilAsegurado | PerfilAsegurador

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  perfil: Perfil
}
