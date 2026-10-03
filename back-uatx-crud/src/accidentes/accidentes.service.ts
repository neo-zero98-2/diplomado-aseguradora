import { randomUUID } from 'node:crypto';
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GEMINI_FALLO, GeminiService } from '../gemini/gemini.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type {
  AccidenteCreado,
  AnalisisFoto,
  ArchivoFoto,
  DatosAccidente,
  EtapaChat,
  MiAccidente,
  RespuestaChat,
} from './accidentes.types.js';
import type { ChatDto } from './dto/chat.dto.js';
import type { CrearAccidenteDto } from './dto/crear-accidente.dto.js';
import { ESQUEMA_RESPUESTA_CHAT, instruccionesEntrevista } from './prompt.js';
import {
  firmarConstancia,
  huellaSha256,
  VIGENCIA_CONSTANCIA_MS,
  verificarConstancia,
} from './constancia.js';

export const MENSAJE_NO_PROCEDE =
  'No procede: la foto no muestra un accidente vehicular.';
export const CONSTANCIA_INVALIDA =
  'La foto no coincide con la analizada o su análisis venció; vuelve a enviarla';

export const BUCKET_FOTOS = 'accidentes-fotos';

const EXTENSIONES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class AccidentesService {
  constructor(
    private readonly gemini: GeminiService,
    private readonly supabase: SupabaseService,
  ) {}

  // Guarda el accidente solo si la constancia es válida, es de este asegurado
  // y corresponde a esta foto exacta; la descripción y la gravedad salen de ella
  async crear(
    aseguradoId: string,
    foto: ArchivoFoto,
    constancia: string,
    dto: CrearAccidenteDto,
  ): Promise<AccidenteCreado> {
    const secreto = secretoConstancia();
    const analisis = verificarConstancia(
      constancia,
      { aseguradoId, fotoSha256: huellaSha256(foto.buffer) },
      secreto,
    );
    if (!analisis) {
      throw new BadRequestException(CONSTANCIA_INVALIDA);
    }

    const tieneCoordenadas =
      dto.latitud !== undefined && dto.longitud !== undefined;
    if (!tieneCoordenadas && !dto.direccion) {
      throw new BadRequestException('Falta la ubicación del accidente');
    }

    const ruta = `${aseguradoId}/${randomUUID()}.${EXTENSIONES[foto.mimetype]}`;
    const fotos = this.supabase.admin.storage.from(BUCKET_FOTOS);
    const { error: errorFoto } = await fotos.upload(ruta, foto.buffer, {
      contentType: foto.mimetype,
      upsert: false,
    });
    if (errorFoto) {
      throw new InternalServerErrorException('No se pudo guardar la foto');
    }

    const { data, error } = await this.supabase.admin
      .from('accidentes')
      .insert({
        asegurado_id: aseguradoId,
        estado: 'pendiente',
        fecha_hora_accidente: dto.fechaHoraAccidente,
        resumen: dto.resumen.trim(),
        asegurado_bien: dto.aseguradoBien,
        latitud: tieneCoordenadas ? dto.latitud : null,
        longitud: tieneCoordenadas ? dto.longitud : null,
        direccion: dto.direccion?.trim() || null,
        vehiculo_marca: dto.vehiculoMarca.trim(),
        vehiculo_modelo: dto.vehiculoModelo.trim(),
        vehiculo_placas: dto.vehiculoPlacas.trim(),
        hay_terceros: dto.hayTerceros,
        terceros_descripcion: dto.hayTerceros
          ? dto.tercerosDescripcion!.trim()
          : null,
        foto_path: ruta,
        foto_descripcion: analisis.descripcion,
        gravedad: analisis.gravedad,
      })
      .select('id, estado')
      .single();
    if (error) {
      // No deben quedar fotos sin accidente en el bucket
      await fotos.remove([ruta]);
      throw new InternalServerErrorException(
        'No se pudo registrar el accidente',
      );
    }

    return { id: data.id, estado: data.estado };
  }

  // Accidentes del asegurado del token, del reporte más reciente al más antiguo
  async listarMios(aseguradoId: string): Promise<MiAccidente[]> {
    const { data, error } = await this.supabase.admin
      .from('accidentes')
      .select(
        'id, fecha_hora_accidente, vehiculo_marca, vehiculo_modelo, vehiculo_placas, gravedad, estado, nota_asegurador',
      )
      .eq('asegurado_id', aseguradoId)
      .order('fecha_reporte', { ascending: false });
    if (error) {
      throw new InternalServerErrorException(
        'No se pudo listar tus accidentes',
      );
    }
    return data.map((fila) => ({
      id: fila.id,
      fechaHoraAccidente: fila.fecha_hora_accidente,
      vehiculoMarca: fila.vehiculo_marca,
      vehiculoModelo: fila.vehiculo_modelo,
      vehiculoPlacas: fila.vehiculo_placas,
      gravedad: fila.gravedad,
      estado: fila.estado,
      notaAsegurador: fila.nota_asegurador,
    }));
  }

  // Analiza la foto con Gemini; no guarda nada. Si procede, devuelve la
  // constancia firmada que amarra el análisis a esta foto y a este asegurado
  async analizarFoto(
    aseguradoId: string,
    foto: ArchivoFoto,
  ): Promise<AnalisisFoto> {
    // Antes de llamar a Gemini, para no gastar el análisis si no se puede firmar
    const secreto = secretoConstancia();
    const analisis = await this.gemini.analizarFoto(foto.buffer, foto.mimetype);

    if (!analisis.esAccidente) {
      return {
        procede: false,
        mensaje: `${MENSAJE_NO_PROCEDE} ${analisis.descripcion}`,
      };
    }

    const constancia = firmarConstancia(
      {
        aseguradoId,
        fotoSha256: huellaSha256(foto.buffer),
        descripcion: analisis.descripcion,
        gravedad: analisis.gravedad,
        expira: Date.now() + VIGENCIA_CONSTANCIA_MS,
      },
      secreto,
    );
    return {
      procede: true,
      descripcion: analisis.descripcion,
      gravedad: analisis.gravedad,
      constancia,
    };
  }

  // Un turno de la entrevista guiada; el backend no guarda la conversación
  async conversar(dto: ChatDto): Promise<RespuestaChat> {
    const respuesta: any = await this.gemini.conversar({
      instrucciones: instruccionesEntrevista(new Date()),
      mensajes: dto.mensajes,
      esquema: ESQUEMA_RESPUESTA_CHAT,
    });

    if (typeof respuesta?.mensaje !== 'string' || !respuesta.mensaje.trim()) {
      throw new BadGatewayException(GEMINI_FALLO);
    }

    const datos = leerDatos(respuesta.datos);
    // La IA no puede cerrar un reporte incompleto
    const etapa: EtapaChat =
      respuesta.etapa === 'confirmacion' && datosCompletos(datos)
        ? 'confirmacion'
        : 'entrevista';

    return {
      mensaje: respuesta.mensaje.trim(),
      etapa,
      sugerir911: respuesta.sugerir911 === true,
      datos,
    };
  }
}

// Conserva solo los campos conocidos con el tipo correcto; lo demás se descarta
function leerDatos(crudo: any): Partial<DatosAccidente> {
  const datos: Partial<DatosAccidente> = {};
  if (typeof crudo !== 'object' || crudo === null) return datos;

  for (const campo of CAMPOS_TEXTO) {
    const valor = crudo[campo];
    if (typeof valor === 'string' && valor.trim()) {
      datos[campo] = valor.trim();
    }
  }
  if (typeof crudo.aseguradoBien === 'boolean') {
    datos.aseguradoBien = crudo.aseguradoBien;
  }
  if (typeof crudo.hayTerceros === 'boolean') {
    datos.hayTerceros = crudo.hayTerceros;
  }
  if (
    datos.fechaHoraAccidente &&
    Number.isNaN(Date.parse(datos.fechaHoraAccidente))
  ) {
    delete datos.fechaHoraAccidente;
  }
  return datos;
}

const CAMPOS_TEXTO = [
  'fechaHoraAccidente',
  'resumen',
  'direccion',
  'vehiculoMarca',
  'vehiculoModelo',
  'vehiculoPlacas',
  'tercerosDescripcion',
] as const;

// Campos obligatorios de DatosAccidente; la descripción de terceros solo si los hubo
export function datosCompletos(
  datos: Partial<DatosAccidente>,
): datos is DatosAccidente {
  return (
    datos.aseguradoBien !== undefined &&
    !!datos.fechaHoraAccidente &&
    !!datos.resumen &&
    !!datos.vehiculoMarca &&
    !!datos.vehiculoModelo &&
    !!datos.vehiculoPlacas &&
    datos.hayTerceros !== undefined &&
    (!datos.hayTerceros || !!datos.tercerosDescripcion)
  );
}

// Se lee al usarse, igual que las variables de Gemini: si falta, 503
function secretoConstancia(): string {
  const secreto = process.env.CONSTANCIA_SECRET;
  if (!secreto) {
    throw new ServiceUnavailableException('El asistente no está configurado');
  }
  return secreto;
}
