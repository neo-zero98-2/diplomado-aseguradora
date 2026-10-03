import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  type Content,
  type ContentListUnion,
  type FunctionDeclaration,
  type GenerateContentResponse,
  type Part,
} from '@google/genai';
import { GRAVEDADES, type Gravedad } from '../accidentes/constancia.js';

export const GEMINI_NO_DISPONIBLE = 'El asistente no está configurado';
export const GEMINI_FALLO = 'No se pudo contactar al asistente';

// Resultado del análisis de la foto de un accidente
export interface AnalisisGemini {
  esAccidente: boolean;
  descripcion: string;
  gravedad: Gravedad;
}

export interface MensajeConversacion {
  rol: 'usuario' | 'asistente';
  texto: string;
}

interface PeticionConversacion {
  instrucciones: string;
  mensajes: MensajeConversacion[];
  esquema: unknown;
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

export interface PeticionConHerramientas {
  instrucciones: string;
  mensajes: MensajeConversacion[];
  herramientas: FunctionDeclaration[];
  // Herramienta con la que Gemini cierra el turno; sus argumentos son la respuesta
  herramientaFinal: string;
  // Ejecuta las demás herramientas; lo que devuelve se le pasa a Gemini
  ejecutar: (nombre: string, args: Record<string, unknown>) => unknown;
  // Rondas de herramientas permitidas antes de llamar a la final
  maxRondas: number;
}

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

  // Un turno de conversación: manda el historial completo y devuelve el JSON
  // de la siguiente respuesta del asistente
  conversar(peticion: PeticionConversacion): Promise<unknown> {
    return this.generarJson({
      instrucciones: peticion.instrucciones,
      contenido: aContenidos(peticion.mensajes),
      esquema: peticion.esquema,
    });
  }

  // Ciclo de function calling: Gemini está obligado a llamar herramientas
  // (mode ANY); cada ronda ejecuta las que pidió y le devuelve los resultados,
  // hasta que llama a la herramienta final. Pasar de maxRondas responde 502
  async conversarConHerramientas(
    peticion: PeticionConHerramientas,
  ): Promise<Record<string, unknown>> {
    const { ai, modelo } = this.configuracion();
    const contenidos = aContenidos(peticion.mensajes);

    for (let ronda = 0; ; ronda++) {
      let respuesta: GenerateContentResponse;
      try {
        respuesta = await ai.models.generateContent({
          model: modelo,
          contents: contenidos,
          config: {
            systemInstruction: peticion.instrucciones,
            tools: [{ functionDeclarations: peticion.herramientas }],
            toolConfig: {
              functionCallingConfig: { mode: FunctionCallingConfigMode.ANY },
            },
          },
        });
      } catch {
        throw new BadGatewayException(GEMINI_FALLO);
      }

      const llamadas = respuesta.functionCalls ?? [];
      const final = llamadas.find((l) => l.name === peticion.herramientaFinal);
      if (final) {
        return final.args ?? {};
      }
      // Sin llamadas (no debería pasar con mode ANY) o sin rondas disponibles
      if (llamadas.length === 0 || ronda >= peticion.maxRondas) {
        throw new BadGatewayException(GEMINI_FALLO);
      }

      // Se conserva el turno del modelo tal cual: con Gemini 3 trae las firmas
      // de pensamiento que la siguiente ronda necesita
      contenidos.push(
        respuesta.candidates?.[0]?.content ?? {
          role: 'model',
          parts: llamadas.map((functionCall) => ({ functionCall })),
        },
      );

      const resultados: Part[] = [];
      for (const llamada of llamadas) {
        const resultado = await peticion.ejecutar(
          llamada.name ?? '',
          llamada.args ?? {},
        );
        resultados.push({
          functionResponse: {
            id: llamada.id,
            name: llamada.name,
            response: { output: resultado },
          },
        });
      }
      contenidos.push({ role: 'user', parts: resultados });
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

// Gemini espera que la conversación empiece con el usuario y que los turnos
// se alternen: los mensajes seguidos del mismo rol se juntan en un turno, y si
// el chat abre con el asistente ("¿Estás bien?") se antepone un turno del usuario
function aContenidos(mensajes: MensajeConversacion[]): Content[] {
  const contenidos: Content[] = [];
  for (const { rol, texto } of mensajes) {
    const role = rol === 'usuario' ? 'user' : 'model';
    const ultimo = contenidos.at(-1);
    if (ultimo?.role === role) {
      ultimo.parts!.push({ text: texto });
    } else {
      contenidos.push({ role, parts: [{ text: texto }] });
    }
  }
  if (contenidos[0]?.role === 'model') {
    contenidos.unshift({
      role: 'user',
      parts: [{ text: 'Quiero reportar un accidente.' }],
    });
  }
  return contenidos;
}
