import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { GeminiService } from '../gemini/gemini.service.js';
import type { AnalisisFoto, ArchivoFoto } from './accidentes.types.js';
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
}

// Se lee al usarse, igual que las variables de Gemini: si falta, 503
function secretoConstancia(): string {
  const secreto = process.env.CONSTANCIA_SECRET;
  if (!secreto) {
    throw new ServiceUnavailableException('El asistente no está configurado');
  }
  return secreto;
}
