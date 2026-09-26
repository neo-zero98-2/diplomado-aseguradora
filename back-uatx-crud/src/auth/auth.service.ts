import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { LoginResponse } from './auth.types.js';

const CREDENCIALES_INVALIDAS = 'Credenciales inválidas';

@Injectable()
export class AuthService {
  constructor(private readonly supabase: SupabaseService) {}

  async login(dto: LoginDto): Promise<LoginResponse> {
    const identificador = dto.identificador.trim();
    const correo = await this.resolverCorreo(identificador);

    // Se valida antes de autenticar para no generar sesión con un contrato vencido
    await this.validarContratoVigente(correo);

    const { data, error } = await this.supabase.anon.auth.signInWithPassword({
      email: correo,
      password: dto.contrasena,
    });
    if (error || !data.session) {
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      perfil: await this.obtenerPerfil(data.user.id, data.user.email ?? correo),
    };
  }

  // Con "@" es un correo; si no, se busca como id_contrato y luego como id_empleado
  private async resolverCorreo(identificador: string): Promise<string> {
    if (identificador.includes('@')) {
      return identificador.toLowerCase();
    }

    const { data: asegurado } = await this.supabase.admin
      .from('asegurados')
      .select('correo')
      .eq('id_contrato', identificador)
      .maybeSingle();
    if (asegurado) {
      return asegurado.correo;
    }

    const { data: asegurador } = await this.supabase.admin
      .from('aseguradores')
      .select('id')
      .eq('id_empleado', identificador)
      .maybeSingle();
    if (asegurador) {
      const { data } = await this.supabase.admin.auth.admin.getUserById(
        asegurador.id,
      );
      if (data.user?.email) {
        return data.user.email;
      }
    }

    throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
  }

  private async validarContratoVigente(correo: string): Promise<void> {
    const { data: asegurado } = await this.supabase.admin
      .from('asegurados')
      .select('fecha_vencimiento')
      .eq('correo', correo)
      .maybeSingle();

    if (asegurado && asegurado.fecha_vencimiento < fechaHoy()) {
      throw new ForbiddenException('El contrato ha vencido');
    }
  }

  private async obtenerPerfil(
    id: string,
    correo: string,
  ): Promise<LoginResponse['perfil']> {
    const { data: asegurado } = await this.supabase.admin
      .from('asegurados')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (asegurado) {
      return {
        rol: 'asegurado',
        nombre: asegurado.nombre,
        edad: asegurado.edad,
        idContrato: asegurado.id_contrato,
        fechaVencimiento: asegurado.fecha_vencimiento,
        fechaRegistro: asegurado.fecha_registro,
        correo: asegurado.correo,
      };
    }

    const { data: asegurador } = await this.supabase.admin
      .from('aseguradores')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (asegurador) {
      return {
        rol: 'asegurador',
        nombre: asegurador.nombre,
        edad: asegurador.edad,
        idEmpleado: asegurador.id_empleado,
        correo,
      };
    }

    // Cuenta de Auth sin perfil en ninguna tabla
    throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
  }
}

// Fecha local del servidor en formato YYYY-MM-DD (mismo formato que las columnas date)
function fechaHoy(): string {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}
