import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  GeminiService,
  type PeticionConHerramientas,
} from './gemini.service.js';

// SDK falso: cada llamada a generateContent devuelve la siguiente respuesta
// que la prueba encola con mockResolvedValueOnce
const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock('@google/genai', async (importOriginal) => {
  const real = await importOriginal<typeof import('@google/genai')>();
  return {
    ...real,
    GoogleGenAI: class {
      models = { generateContent };
    },
  };
});

function llamada(name: string, args: Record<string, unknown>, id?: string) {
  const functionCall = { name, args, id };
  return {
    functionCalls: [functionCall],
    candidates: [{ content: { role: 'model', parts: [{ functionCall }] } }],
  };
}

function peticion(
  cambios: Partial<PeticionConHerramientas> = {},
): PeticionConHerramientas {
  return {
    instrucciones: 'Instrucciones de prueba',
    mensajes: [{ rol: 'usuario', texto: '¿Cuántos hay pendientes?' }],
    herramientas: [{ name: 'contar' }, { name: 'responder' }],
    herramientaFinal: 'responder',
    ejecutar: vi.fn(() => ({ total: 3 })),
    maxRondas: 5,
    ...cambios,
  };
}

describe('GeminiService.conversarConHerramientas', () => {
  beforeEach(() => {
    generateContent.mockReset();
    vi.stubEnv('GEMINI_API_KEY', 'key-de-prueba');
    vi.stubEnv('GEMINI_MODEL', 'modelo-de-prueba');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('ejecuta la herramienta, le devuelve el resultado a Gemini y regresa los argumentos de la final', async () => {
    generateContent
      .mockResolvedValueOnce(llamada('contar', { gravedad: 'grave' }, 'c1'))
      .mockResolvedValueOnce(
        llamada('responder', { mensaje: 'Hay 3', accidentesIds: [] }),
      );
    const datos = peticion();

    const respuesta = await new GeminiService().conversarConHerramientas(datos);

    expect(respuesta).toEqual({ mensaje: 'Hay 3', accidentesIds: [] });
    expect(datos.ejecutar).toHaveBeenCalledWith('contar', {
      gravedad: 'grave',
    });

    // Primera llamada: function calling obligatorio con las herramientas
    const [primera] = generateContent.mock.calls[0];
    expect(primera.model).toBe('modelo-de-prueba');
    expect(primera.config.tools).toEqual([
      { functionDeclarations: datos.herramientas },
    ]);
    expect(primera.config.toolConfig.functionCallingConfig.mode).toBe('ANY');

    // Segunda llamada: el historial trae el turno del modelo y el resultado
    const [segunda] = generateContent.mock.calls[1];
    expect(segunda.contents.slice(-2)).toEqual([
      {
        role: 'model',
        parts: [
          {
            functionCall: {
              name: 'contar',
              args: { gravedad: 'grave' },
              id: 'c1',
            },
          },
        ],
      },
      {
        role: 'user',
        parts: [
          {
            functionResponse: {
              id: 'c1',
              name: 'contar',
              response: { output: { total: 3 } },
            },
          },
        ],
      },
    ]);
  });

  it('regresa directo si Gemini llama a la final en la primera ronda', async () => {
    generateContent.mockResolvedValueOnce(
      llamada('responder', {
        mensaje: 'Solo ayudo con accidentes',
        accidentesIds: [],
      }),
    );
    const datos = peticion();

    await expect(
      new GeminiService().conversarConHerramientas(datos),
    ).resolves.toMatchObject({ mensaje: 'Solo ayudo con accidentes' });
    expect(datos.ejecutar).not.toHaveBeenCalled();
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('responde 502 si pasa de maxRondas sin llamar a la final', async () => {
    generateContent.mockResolvedValue(llamada('contar', {}));
    const datos = peticion({ maxRondas: 5 });

    await expect(
      new GeminiService().conversarConHerramientas(datos),
    ).rejects.toThrow(BadGatewayException);
    // 5 rondas de herramientas y una sexta llamada que tampoco responde
    expect(generateContent).toHaveBeenCalledTimes(6);
    expect(datos.ejecutar).toHaveBeenCalledTimes(5);
  });

  it('responde 502 si Gemini no llama ninguna herramienta o falla', async () => {
    generateContent.mockResolvedValueOnce({
      text: 'Hola',
      functionCalls: undefined,
    });
    await expect(
      new GeminiService().conversarConHerramientas(peticion()),
    ).rejects.toThrow(BadGatewayException);

    generateContent.mockRejectedValueOnce(new Error('cuota excedida'));
    await expect(
      new GeminiService().conversarConHerramientas(peticion()),
    ).rejects.toThrow(BadGatewayException);
  });

  it('responde 503 sin GEMINI_API_KEY', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');

    await expect(
      new GeminiService().conversarConHerramientas(peticion()),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(generateContent).not.toHaveBeenCalled();
  });
});
