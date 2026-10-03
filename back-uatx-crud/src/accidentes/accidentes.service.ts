import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GEMINI_FALLO, GeminiService } from '../gemini/gemini.service.js';
import type {
  AnalisisFoto,
  ArchivoFoto,
  DatosAccidente,
  EtapaChat,
  RespuestaChat,
} from './accidentes.types.js';
import type { ChatDto } from './dto/chat.dto.js';
import { ESQUEMA_RESPUESTA_CHAT, instruccionesEntrevista } from './prompt.js';
import {
  firmarConstancia,
  huellaSha256,
  VIGENCIA_CONSTANCIA_MS,
} from './constancia.js';

export const MENSAJE_NO_PROCEDE =
  'No procede: la foto no muestra un accidente vehicular.';

@Injectable()
export class AccidentesService {
  constructor(private readonly gemini: GeminiService) {}

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
