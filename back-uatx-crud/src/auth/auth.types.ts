export interface PerfilAsegurado {
  rol: 'asegurado';
  nombre: string;
  edad: number;
  idContrato: string;
  fechaVencimiento: string;
  fechaRegistro: string;
  correo: string;
}

export interface PerfilAsegurador {
  rol: 'asegurador';
  nombre: string;
  edad: number;
  idEmpleado: string;
  correo: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  perfil: PerfilAsegurado | PerfilAsegurador;
}
