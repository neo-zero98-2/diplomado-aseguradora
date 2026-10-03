import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { BUCKET_FOTOS } from './accidentes.service.js';
import type { AccidenteAsegurador, FotoAccidente } from './accidentes.types.js';
import type { ActualizarAccidenteDto } from './dto/actualizar-accidente.dto.js';

export const ACCIDENTE_NO_ENCONTRADO = 'El accidente no existe';

// Vigencia de la URL firmada de la foto: 10 minutos
const VIGENCIA_URL_FOTO_S = 600;

// Columnas del accidente, su asegurado y el asegurador de la última
// actualización. accidentes tiene dos FKs, así que cada join nombra la suya
export const SELECT_ACCIDENTE_ASEGURADOR = `
  *,
  asegurado:asegurados!asegurado_id (id, nombre, id_contrato, correo, fecha_vencimiento),
  actualizado:aseguradores!actualizado_por (id, nombre)
`;

// Herramienta de trabajo del asegurador: ve todos los accidentes
@Injectable()
export class AccidentesAseguradorService {
  private readonly logger = new Logger(AccidentesAseguradorService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // Todos los accidentes, del reporte más reciente al más antiguo; el filtro
  // por estado y la búsqueda se hacen en el cliente
  async listar(): Promise<AccidenteAsegurador[]> {
    const { data, error } = await this.supabase.admin
      .from('accidentes')
      .select(SELECT_ACCIDENTE_ASEGURADOR)
      .order('fecha_reporte', { ascending: false });
    if (error) {
      throw new InternalServerErrorException('No se pudo listar accidentes');
    }
    return data.map(aAccidenteAsegurador);
  }

  // Un accidente con su asegurado; el chat lo usa para abrir el detalle
  async obtener(id: string): Promise<AccidenteAsegurador> {
    const { data, error } = await this.supabase.admin
      .from('accidentes')
      .select(SELECT_ACCIDENTE_ASEGURADOR)
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException('No se pudo obtener el accidente');
    }
    if (!data) {
      throw new NotFoundException(ACCIDENTE_NO_ENCONTRADO);
    }
    return aAccidenteAsegurador(data);
  }

  // Cambia el estado y/o la nota, y deja registrado quién y cuándo lo hizo
  async actualizar(
    id: string,
    aseguradorId: string,
    dto: ActualizarAccidenteDto,
  ): Promise<AccidenteAsegurador> {
    if (dto.estado === undefined && dto.notaAsegurador === undefined) {
      throw new BadRequestException('Indica el estado o la nota a cambiar');
    }

    const cambios: Record<string, unknown> = {
      actualizado_por: aseguradorId,
      fecha_actualizacion: new Date().toISOString(),
    };
    if (dto.estado !== undefined) {
      cambios.estado = dto.estado;
    }
    if (dto.notaAsegurador !== undefined) {
      // Una nota vacía se guarda como null
      cambios.nota_asegurador = dto.notaAsegurador?.trim() || null;
    }

    const { data, error } = await this.supabase.admin
      .from('accidentes')
      .update(cambios)
      .eq('id', id)
      .select(SELECT_ACCIDENTE_ASEGURADOR)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(
        'No se pudo actualizar el accidente',
      );
    }
    if (!data) {
      throw new NotFoundException(ACCIDENTE_NO_ENCONTRADO);
    }
    return aAccidenteAsegurador(data);
  }

  // El bucket es privado: la foto solo se ve con una URL firmada temporal
  async obtenerFoto(id: string): Promise<FotoAccidente> {
    const { data: accidente, error } = await this.supabase.admin
      .from('accidentes')
      .select('foto_path')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException('No se pudo obtener la foto');
    }
    if (!accidente) {
      throw new NotFoundException(ACCIDENTE_NO_ENCONTRADO);
    }

    const { data, error: errorUrl } = await this.supabase.admin.storage
      .from(BUCKET_FOTOS)
      .createSignedUrl(accidente.foto_path, VIGENCIA_URL_FOTO_S);
    if (errorUrl || !data) {
      throw new InternalServerErrorException('No se pudo obtener la foto');
    }
    return { url: data.signedUrl };
  }

  // Borrado físico: primero la fila y después su foto. Una foto huérfana es
  // menos grave que un accidente sin foto, así que si falla solo se registra
  async eliminar(id: string): Promise<void> {
    const { data, error } = await this.supabase.admin
      .from('accidentes')
      .delete()
      .eq('id', id)
      .select('foto_path')
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(
        'No se pudo eliminar el accidente',
      );
    }
    if (!data) {
      throw new NotFoundException(ACCIDENTE_NO_ENCONTRADO);
    }

    const { error: errorFoto } = await this.supabase.admin.storage
      .from(BUCKET_FOTOS)
      .remove([data.foto_path]);
    if (errorFoto) {
      this.logger.error(
        `No se pudo borrar la foto huérfana ${data.foto_path}: ${errorFoto.message}`,
      );
    }
  }
}

export function aAccidenteAsegurador(fila: any): AccidenteAsegurador {
  return {
    id: fila.id,
    estado: fila.estado,
    fechaHoraAccidente: fila.fecha_hora_accidente,
    fechaReporte: fila.fecha_reporte,
    resumen: fila.resumen,
    aseguradoBien: fila.asegurado_bien,
    latitud: fila.latitud,
    longitud: fila.longitud,
    direccion: fila.direccion,
    vehiculoMarca: fila.vehiculo_marca,
    vehiculoModelo: fila.vehiculo_modelo,
    vehiculoPlacas: fila.vehiculo_placas,
    hayTerceros: fila.hay_terceros,
    tercerosDescripcion: fila.terceros_descripcion,
    fotoDescripcion: fila.foto_descripcion,
    gravedad: fila.gravedad,
    notaAsegurador: fila.nota_asegurador,
    fechaActualizacion: fila.fecha_actualizacion,
    actualizadoPor: fila.actualizado
      ? { id: fila.actualizado.id, nombre: fila.actualizado.nombre }
      : null,
    asegurado: {
      id: fila.asegurado.id,
      nombre: fila.asegurado.nombre,
      idContrato: fila.asegurado.id_contrato,
      correo: fila.asegurado.correo,
      fechaVencimiento: fila.asegurado.fecha_vencimiento,
    },
  };
}
