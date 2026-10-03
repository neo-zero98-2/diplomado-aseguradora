import { BadGatewayException } from '@nestjs/common';
import type {
  GeminiService,
  PeticionConHerramientas,
} from '../gemini/gemini.service.js';
import type { AccidentesAseguradorService } from './accidentes-asegurador.service.js';
import type { AccidenteAsegurador } from './accidentes.types.js';
import { ConsultaAseguradorService } from './consulta-asegurador.service.js';

function accidente(id: string, placas = 'TLX-123-A'): AccidenteAsegurador {
  return {
    id,
    estado: 'pendiente',
    fechaHoraAccidente: '2026-10-01T18:00:00+00:00',
    fechaReporte: '2026-10-01T19:00:00+00:00',
    resumen: 'Choque por alcance',
    aseguradoBien: true,
    latitud: 19.31,
    longitud: -98.24,
    direccion: null,
    vehiculoMarca: 'Nissan',
    vehiculoModelo: 'Versa',
    vehiculoPlacas: placas,
    hayTerceros: false,
    tercerosDescripcion: null,
    fotoDescripcion: 'Dos autos con daños en la defensa',
    gravedad: 'leve',
    notaAsegurador: null,
    fechaActualizacion: null,
    actualizadoPor: null,
    asegurado: {
      id: 'asegurado-1',
      nombre: 'Ana López',
      idContrato: 'CTR-01',
      correo: 'ana@correo.com',
      fechaVencimiento: '2030-12-31',
    },
  };
}

const DTO = {
  mensajes: [{ rol: 'usuario' as const, texto: '¿Cuántos hay pendientes?' }],
  zonaHoraria: 'America/Mexico_City',
};

// Gemini falso: `turno` recibe la petición (para llamar a ejecutar como lo
// haría el ciclo real) y devuelve los argumentos de responder
function crearServicio(
  lista: AccidenteAsegurador[],
  turno: (
    peticion: PeticionConHerramientas,
  ) => Promise<Record<string, unknown>>,
) {
  const conversarConHerramientas = vi.fn(turno);
  const listar = vi.fn(async () => lista);
  const servicio = new ConsultaAseguradorService(
    { conversarConHerramientas } as unknown as GeminiService,
    { listar } as unknown as AccidentesAseguradorService,
  );
  return { servicio, conversarConHerramientas, listar };
}

describe('ConsultaAseguradorService', () => {
  it('ejecuta las herramientas sobre la lista y la carga una sola vez por turno', async () => {
    const resultados: unknown[] = [];
    const { servicio, conversarConHerramientas, listar } = crearServicio(
      [accidente('a1'), accidente('a2', 'PUE-987-B')],
      async ({ ejecutar }) => {
        resultados.push(await ejecutar('contar_accidentes', {}));
        resultados.push(
          await ejecutar('buscar_accidentes', { texto: 'pue987b' }),
        );
        resultados.push(await ejecutar('detalle_accidente', { id: 'a1' }));
        resultados.push(await ejecutar('borrar_todo', {}));
        return { mensaje: '  Hay 2 pendientes  ', accidentesIds: [] };
      },
    );

    const respuesta = await servicio.consultar(DTO);

    expect(respuesta).toEqual({ mensaje: 'Hay 2 pendientes', accidentes: [] });
    expect(listar).toHaveBeenCalledTimes(1);
    expect(resultados[0]).toMatchObject({
      total: 2,
      porEstado: { pendiente: 2 },
    });
    expect(resultados[1]).toMatchObject({
      total: 1,
      accidentes: [{ id: 'a2' }],
    });
    expect(resultados[2]).toMatchObject({ id: 'a1' });
    expect(resultados[3]).toEqual({
      error: 'No existe la herramienta borrar_todo',
    });

    const [peticion] = conversarConHerramientas.mock.calls[0];
    expect(peticion.herramientaFinal).toBe('responder');
    expect(peticion.maxRondas).toBe(5);
    expect(peticion.mensajes).toBe(DTO.mensajes);
    expect(peticion.instrucciones).toContain('America/Mexico_City');
  });

  it('no carga la lista si Gemini responde sin herramientas ni accidentes', async () => {
    const { servicio, listar } = crearServicio([accidente('a1')], async () => ({
      mensaje: 'Solo puedo ayudarte con accidentes y sus asegurados',
      accidentesIds: [],
    }));

    await expect(servicio.consultar(DTO)).resolves.toEqual({
      mensaje: 'Solo puedo ayudarte con accidentes y sus asegurados',
      accidentes: [],
    });
    expect(listar).not.toHaveBeenCalled();
  });

  it('arma la lista "Ver" desde la base: descarta ids inexistentes y repetidos', async () => {
    const { servicio } = crearServicio(
      [accidente('a1'), accidente('a2')],
      async () => ({
        mensaje: 'Estos son',
        accidentesIds: ['a2', 'inventado', 'a2', 42, 'a1'],
      }),
    );

    const { accidentes } = await servicio.consultar(DTO);

    expect(accidentes).toEqual([
      {
        id: 'a2',
        aseguradoNombre: 'Ana López',
        vehiculoPlacas: 'TLX-123-A',
        estado: 'pendiente',
        gravedad: 'leve',
        fechaHoraAccidente: '2026-10-01T18:00:00+00:00',
      },
      expect.objectContaining({ id: 'a1' }),
    ]);
  });

  it('devuelve como máximo 10 accidentes mencionados', async () => {
    const lista = Array.from({ length: 15 }, (_, i) => accidente(`a${i}`));
    const { servicio } = crearServicio(lista, async () => ({
      mensaje: 'Hay 15',
      accidentesIds: lista.map((a) => a.id),
    }));

    const { accidentes } = await servicio.consultar(DTO);

    expect(accidentes).toHaveLength(10);
    expect(accidentes[0].id).toBe('a0');
  });

  it('responde 502 si Gemini manda un mensaje vacío', async () => {
    const { servicio } = crearServicio([], async () => ({
      mensaje: '   ',
      accidentesIds: [],
    }));

    await expect(servicio.consultar(DTO)).rejects.toThrow(BadGatewayException);
  });

  it('trata accidentesIds ausente como lista vacía', async () => {
    const { servicio } = crearServicio([accidente('a1')], async () => ({
      mensaje: 'Hay 1',
    }));

    await expect(servicio.consultar(DTO)).resolves.toEqual({
      mensaje: 'Hay 1',
      accidentes: [],
    });
  });
});
