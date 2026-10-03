import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { aAsegurado, type Asegurado } from './asegurados.types.js';
import type { CrearAseguradoDto } from './dto/crear-asegurado.dto.js';

// Código de Postgres para violación de restricción UNIQUE
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class AseguradosService {
  constructor(private readonly supabase: SupabaseService) {}

  async listar(): Promise<Asegurado[]> {
    const { data, error } = await this.supabase.admin
      .from('asegurados')
      .select('*')
      .order('nombre');
    if (error) {
      throw new InternalServerErrorException('No se pudo listar asegurados');
    }
    return data.map(aAsegurado);
  }

  async crear(dto: CrearAseguradoDto): Promise<Asegurado> {
    // El login busca correos en minúsculas
    const correo = dto.correo.trim().toLowerCase();

    const { data: cuenta, error: errorCuenta } =
      await this.supabase.admin.auth.admin.createUser({
        email: correo,
        password: dto.contrasena,
        email_confirm: true,
      });
    if (errorCuenta || !cuenta.user) {
      if (errorCuenta?.code === 'email_exists') {
        throw new ConflictException('El correo ya está registrado');
      }
      throw new InternalServerErrorException('No se pudo crear la cuenta');
    }

    const { data, error } = await this.supabase.admin
      .from('asegurados')
      .insert({
        id: cuenta.user.id,
        nombre: dto.nombre.trim(),
        edad: dto.edad,
        id_contrato: dto.idContrato.trim(),
        fecha_vencimiento: dto.fechaVencimiento,
        correo,
      })
      .select()
      .single();
    if (error) {
      // Evita dejar una cuenta huérfana en auth.users
      await this.supabase.admin.auth.admin.deleteUser(cuenta.user.id);
      if (error.code === UNIQUE_VIOLATION) {
        throw new ConflictException('El correo o el idContrato ya existen');
      }
      throw new InternalServerErrorException('No se pudo crear el asegurado');
    }

    return aAsegurado(data);
  }
}
