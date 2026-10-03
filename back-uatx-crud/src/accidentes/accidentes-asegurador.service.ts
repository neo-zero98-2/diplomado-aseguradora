import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { AccidenteAsegurador } from './accidentes.types.js';
import type { ActualizarAccidenteDto } from './dto/actualizar-accidente.dto.js';

export const ACCIDENTE_NO_ENCONTRADO = 'El accidente no existe';

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
