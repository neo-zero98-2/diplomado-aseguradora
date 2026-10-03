import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import {
  aAsegurado,
  type Asegurado,
  type FilaAsegurado,
} from './asegurados.types.js';
import type { ActualizarAseguradoDto } from './dto/actualizar-asegurado.dto.js';
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

  async actualizar(
    id: string,
    dto: ActualizarAseguradoDto,
  ): Promise<Asegurado> {
    const actual = await this.buscarFila(id);

    const cambios: Partial<FilaAsegurado> = {};
    if (dto.nombre !== undefined) cambios.nombre = dto.nombre.trim();
    if (dto.edad !== undefined) cambios.edad = dto.edad;
    if (dto.idContrato !== undefined) {
      cambios.id_contrato = dto.idContrato.trim();
    }
    if (dto.fechaVencimiento !== undefined) {
      cambios.fecha_vencimiento = dto.fechaVencimiento;
    }
    if (dto.correo !== undefined) {
      cambios.correo = dto.correo.trim().toLowerCase();
    }
    if (Object.keys(cambios).length === 0) {
      return aAsegurado(actual);
    }

    // El correo se cambia primero en auth.users para que el login siga funcionando
    const cambiaCorreo =
      cambios.correo !== undefined && cambios.correo !== actual.correo;
    if (cambiaCorreo) {
      await this.cambiarCorreoCuenta(id, cambios.correo!);
    }

    const { data, error } = await this.supabase.admin
      .from('asegurados')
      .update(cambios)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      if (cambiaCorreo) {
        // Revierte el correo para que auth.users y la fila no queden distintos
        await this.supabase.admin.auth.admin.updateUserById(id, {
          email: actual.correo,
          email_confirm: true,
        });
      }
      if (error.code === UNIQUE_VIOLATION) {
        throw new ConflictException('El correo o el idContrato ya existen');
      }
      throw new InternalServerErrorException(
        'No se pudo actualizar el asegurado',
      );
    }

    return aAsegurado(data);
  }

  private async buscarFila(id: string): Promise<FilaAsegurado> {
    const { data, error } = await this.supabase.admin
      .from('asegurados')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException('No se pudo leer el asegurado');
    }
    if (!data) {
      throw new NotFoundException('El asegurado no existe');
    }
    return data;
  }

  private async cambiarCorreoCuenta(id: string, correo: string): Promise<void> {
    // updateUserById no distingue un correo duplicado (responde un 500 genérico),
    // así que se verifica antes contra asegurados
    const { data: otro } = await this.supabase.admin
      .from('asegurados')
      .select('id')
      .eq('correo', correo)
      .neq('id', id)
      .maybeSingle();
    if (otro) {
      throw new ConflictException('El correo ya está registrado');
    }

    const { error } = await this.supabase.admin.auth.admin.updateUserById(id, {
      email: correo,
      email_confirm: true,
    });
    if (error) {
      if (error.code === 'email_exists') {
        throw new ConflictException('El correo ya está registrado');
      }
      throw new InternalServerErrorException('No se pudo cambiar el correo');
    }
  }
}
