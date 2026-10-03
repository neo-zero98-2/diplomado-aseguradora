// Nest lo carga al arrancar; aquí lo necesitan los decoradores de class-transformer
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConsultaAseguradorDto } from './consulta-asegurador.dto.js';

const PREGUNTA = { rol: 'usuario', texto: '¿Cuántos hay pendientes?' };

async function errores(body: unknown): Promise<string[]> {
  const resultado = await validate(
    plainToInstance(ConsultaAseguradorDto, body),
  );
  return resultado.map((e) => e.property);
}

describe('ConsultaAseguradorDto', () => {
  it('acepta un historial que termina con el usuario y una zona IANA', async () => {
    expect(
      await errores({
        mensajes: [
          PREGUNTA,
          { rol: 'asistente', texto: 'Hay 2' },
          { rol: 'usuario', texto: '¿De quién son?' },
        ],
        zonaHoraria: 'America/Mexico_City',
      }),
    ).toEqual([]);
  });

  it.each([
    ['sin mensajes', { mensajes: [], zonaHoraria: 'UTC' }, 'mensajes'],
    [
      'más de 40 mensajes',
      { mensajes: Array(41).fill(PREGUNTA), zonaHoraria: 'UTC' },
      'mensajes',
    ],
    [
      'un mensaje de más de 2000 caracteres',
      {
        mensajes: [{ rol: 'usuario', texto: 'a'.repeat(2001) }],
        zonaHoraria: 'UTC',
      },
      'mensajes',
    ],
    [
      'el último mensaje del asistente',
      {
        mensajes: [PREGUNTA, { rol: 'asistente', texto: 'Hay 2' }],
        zonaHoraria: 'UTC',
      },
      'mensajes',
    ],
    [
      'una zona horaria inválida',
      { mensajes: [PREGUNTA], zonaHoraria: 'Marte/Olympus' },
      'zonaHoraria',
    ],
    ['sin zona horaria', { mensajes: [PREGUNTA] }, 'zonaHoraria'],
  ])('rechaza %s', async (_caso, body, propiedad) => {
    expect(await errores(body)).toContain(propiedad);
  });
});
