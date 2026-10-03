import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GoogleGenAI, type ContentListUnion } from '@google/genai';

export const GEMINI_NO_DISPONIBLE = 'El asistente no está configurado';
export const GEMINI_FALLO = 'No se pudo contactar al asistente';

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
