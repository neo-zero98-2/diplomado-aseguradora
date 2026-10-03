import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GoogleGenAI, type ContentListUnion } from '@google/genai';
import { GRAVEDADES, type Gravedad } from '../accidentes/constancia.js';

export const GEMINI_NO_DISPONIBLE = 'El asistente no está configurado';
export const GEMINI_FALLO = 'No se pudo contactar al asistente';

// Resultado del análisis de la foto de un accidente
export interface AnalisisGemini {
  esAccidente: boolean;
  descripcion: string;
  gravedad: Gravedad;
}

const INSTRUCCIONES_FOTO = `Eres el analista de fotos de una aseguradora de autos.
Decide si la foto muestra un accidente vehicular: uno o más vehículos con daños por un choque, volcadura, atropello o impacto.
- esAccidente: true solo si la foto muestra claramente un accidente vehicular. Fotos de vehículos sin daños, paisajes, personas, documentos, capturas de pantalla o imágenes generadas que no muestran un accidente real son false.
- descripcion: una o dos oraciones en español que describan lo que se ve (vehículos, daños visibles). Si no es un accidente, describe brevemente lo que sí muestra la foto.
- gravedad: "leve" (rayones, abolladuras menores), "moderado" (daños en carrocería, faros o defensas, vehículo posiblemente no circulable) o "grave" (daños estructurales, volcadura, bolsas de aire activadas o posibles lesionados). Si no es un accidente, usa "leve".
No inventes detalles que no se vean en la foto.`;

const ESQUEMA_ANALISIS = {
  type: 'object',
  properties: {
    esAccidente: { type: 'boolean' },
    descripcion: { type: 'string' },
    gravedad: { type: 'string', enum: GRAVEDADES },
  },
  required: ['esAccidente', 'descripcion', 'gravedad'],
};

interface PeticionJson {
  contenido: ContentListUnion;
  // JSON Schema de la respuesta esperada
  esquema: unknown;
  instrucciones?: string;
}

// Las variables se leen al usarse, no al arrancar: sin GEMINI_API_KEY o GEMINI_MODEL
// solo fallan (503) las rutas que usan Gemini y el resto del backend sigue funcionando
@Injectable()
export class GeminiService {
  private cliente?: { apiKey: string; ai: GoogleGenAI };

  // Pide a Gemini una respuesta con salida estructurada y la devuelve ya parseada.
  // El llamador valida la forma; aquí solo se garantiza que es JSON.
  async generarJson(peticion: PeticionJson): Promise<unknown> {
    const { ai, modelo } = this.configuracion();

    let texto: string | undefined;
    try {
      const respuesta = await ai.models.generateContent({
        model: modelo,
        contents: peticion.contenido,
        config: {
          systemInstruction: peticion.instrucciones,
          responseMimeType: 'application/json',
          responseJsonSchema: peticion.esquema,
        },
      });
      texto = respuesta.text;
    } catch {
      throw new BadGatewayException(GEMINI_FALLO);
    }

    if (!texto) {
      throw new BadGatewayException(GEMINI_FALLO);
    }
    try {
      return JSON.parse(texto);
    } catch {
      throw new BadGatewayException(GEMINI_FALLO);
    }
  }

  // Pregunta a Gemini si la foto muestra un accidente vehicular
  async analizarFoto(foto: Buffer, mimeType: string): Promise<AnalisisGemini> {
    const respuesta: any = await this.generarJson({
      instrucciones: INSTRUCCIONES_FOTO,
      contenido: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: foto.toString('base64') } },
            { text: 'Analiza esta foto.' },
          ],
        },
      ],
      esquema: ESQUEMA_ANALISIS,
    });

    if (
      typeof respuesta?.esAccidente !== 'boolean' ||
      typeof respuesta.descripcion !== 'string' ||
      !respuesta.descripcion.trim() ||
      !GRAVEDADES.includes(respuesta.gravedad)
    ) {
      throw new BadGatewayException(GEMINI_FALLO);
    }
    return {
      esAccidente: respuesta.esAccidente,
      descripcion: respuesta.descripcion.trim(),
      gravedad: respuesta.gravedad,
    };
  }

  private configuracion(): { ai: GoogleGenAI; modelo: string } {
    const apiKey = process.env.GEMINI_API_KEY;
    const modelo = process.env.GEMINI_MODEL;
    if (!apiKey || !modelo) {
      throw new ServiceUnavailableException(GEMINI_NO_DISPONIBLE);
    }

    // Se reutiliza el cliente mientras la key no cambie
    if (this.cliente?.apiKey !== apiKey) {
      this.cliente = { apiKey, ai: new GoogleGenAI({ apiKey }) };
    }
    return { ai: this.cliente.ai, modelo };
  }
}
