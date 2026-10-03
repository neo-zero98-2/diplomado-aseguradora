import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service.js';
import { AccidentesAseguradorService } from './accidentes-asegurador.service.js';
import { BUCKET_FOTOS } from './accidentes.service.js';

const ID = '13227a72-0000-4000-8000-000000000001';
const ASEGURADOR = 'asegurador-1';

const FILA = {
  id: ID,
  asegurado_id: 'asegurado-1',
  estado: 'pendiente',
  fecha_hora_accidente: '2026-10-03T23:30:00+00:00',
  fecha_reporte: '2026-10-04T00:10:00+00:00',
  resumen: 'Choque por alcance',
  asegurado_bien: true,
  latitud: 19.31,
  longitud: -98.24,
  direccion: null,
  vehiculo_marca: 'Nissan',
  vehiculo_modelo: 'Versa',
  vehiculo_placas: 'TLX-123-A',
  hay_terceros: false,
  terceros_descripcion: null,
  foto_path: 'asegurado-1/foto.jpg',
  foto_descripcion: 'Dos autos con daños en la defensa',
  gravedad: 'moderado',
  nota_asegurador: null,
  actualizado_por: null,
  fecha_actualizacion: null,
  asegurado: {
    id: 'asegurado-1',
    nombre: 'Ana López',
    id_contrato: 'CTR-01',
    correo: 'ana@correo.com',
    fecha_vencimiento: '2030-12-31',
  },
  actualizado: null,
};

// Supabase falso: cada consulta encadena métodos que se registran en `llamadas`
// y termina en order()/maybeSingle(), que resuelven con `resultado`
function crearSupabaseFalso(resultado: { data: unknown; error: unknown }) {
  const llamadas: Record<string, unknown[][]> = {};
  const consulta: Record<string, any> = {};
  for (const metodo of ['select', 'update', 'delete', 'eq']) {
    consulta[metodo] = vi.fn((...args: unknown[]) => {
      (llamadas[metodo] ??= []).push(args);
      return consulta;
    });
  }
  consulta.order = vi.fn(async () => resultado);
  consulta.maybeSingle = vi.fn(async () => resultado);

  const fotos = {
    remove: vi.fn(async () => ({ data: [], error: null })),
  };
  const storageFrom = vi.fn(() => fotos);
  const supabase = {
    admin: { from: vi.fn(() => consulta), storage: { from: storageFrom } },
  };
  return {
    supabase: supabase as unknown as SupabaseService,
    llamadas,
    fotos,
    storageFrom,
  };
}

describe('AccidentesAseguradorService', () => {
  it('listar mapea cada accidente con los datos de su asegurado', async () => {
    const { supabase } = crearSupabaseFalso({ data: [FILA], error: null });
    const servicio = new AccidentesAseguradorService(supabase);

    const [accidente] = await servicio.listar();

    expect(accidente).toMatchObject({
      id: ID,
      estado: 'pendiente',
      fechaReporte: '2026-10-04T00:10:00+00:00',
      vehiculoPlacas: 'TLX-123-A',
      fotoDescripcion: 'Dos autos con daños en la defensa',
      notaAsegurador: null,
      actualizadoPor: null,
      asegurado: {
        id: 'asegurado-1',
        nombre: 'Ana López',
        idContrato: 'CTR-01',
        correo: 'ana@correo.com',
        fechaVencimiento: '2030-12-31',
      },
    });
  });

  it('actualizar escribe el estado, la nota sin espacios, el asegurador y la fecha', async () => {
    const actualizado = {
      ...FILA,
      estado: 'aprobado',
      nota_asegurador: 'Procede el pago',
      actualizado: { id: ASEGURADOR, nombre: 'Luis Pérez' },
    };
    const { supabase, llamadas } = crearSupabaseFalso({
      data: actualizado,
      error: null,
    });
    const servicio = new AccidentesAseguradorService(supabase);
    const antes = Date.now();

    const resultado = await servicio.actualizar(ID, ASEGURADOR, {
      estado: 'aprobado',
      notaAsegurador: '  Procede el pago  ',
    });

    const [cambios] = llamadas.update[0] as [Record<string, string>];
    expect(cambios).toMatchObject({
      estado: 'aprobado',
      nota_asegurador: 'Procede el pago',
      actualizado_por: ASEGURADOR,
    });
    expect(Date.parse(cambios.fecha_actualizacion)).toBeGreaterThanOrEqual(
      antes - 1000,
    );
    expect(llamadas.eq).toContainEqual(['id', ID]);
    expect(resultado.actualizadoPor).toEqual({
      id: ASEGURADOR,
      nombre: 'Luis Pérez',
    });
  });

  it('actualizar guarda una nota vacía como null', async () => {
    const { supabase, llamadas } = crearSupabaseFalso({
      data: FILA,
      error: null,
    });
    const servicio = new AccidentesAseguradorService(supabase);

    await servicio.actualizar(ID, ASEGURADOR, { notaAsegurador: '   ' });

    const [cambios] = llamadas.update[0] as [Record<string, unknown>];
    expect(cambios.nota_asegurador).toBeNull();
    expect(cambios).not.toHaveProperty('estado');
  });

  it('actualizar con el body vacío responde 400 sin tocar la tabla', async () => {
    const { supabase, llamadas } = crearSupabaseFalso({
      data: FILA,
      error: null,
    });
    const servicio = new AccidentesAseguradorService(supabase);

    await expect(servicio.actualizar(ID, ASEGURADOR, {})).rejects.toThrow(
      BadRequestException,
    );
    expect(llamadas.update).toBeUndefined();
  });

  it('actualizar un accidente inexistente responde 404', async () => {
    const { supabase } = crearSupabaseFalso({ data: null, error: null });
    const servicio = new AccidentesAseguradorService(supabase);

    await expect(
      servicio.actualizar(ID, ASEGURADOR, { estado: 'rechazado' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('eliminar borra la fila y después su foto', async () => {
    const { supabase, llamadas, fotos, storageFrom } = crearSupabaseFalso({
      data: { foto_path: FILA.foto_path },
      error: null,
    });
    const servicio = new AccidentesAseguradorService(supabase);

    await servicio.eliminar(ID);

    expect(llamadas.delete).toHaveLength(1);
    expect(llamadas.eq).toContainEqual(['id', ID]);
    expect(storageFrom).toHaveBeenCalledWith(BUCKET_FOTOS);
    expect(fotos.remove).toHaveBeenCalledWith([FILA.foto_path]);
  });

  it('eliminar responde aunque falle el borrado de la foto', async () => {
    const { supabase, fotos } = crearSupabaseFalso({
      data: { foto_path: FILA.foto_path },
      error: null,
    });
    fotos.remove.mockResolvedValue({
      data: null,
      error: { message: 'Storage caído' },
    } as any);
    const servicio = new AccidentesAseguradorService(supabase);

    await expect(servicio.eliminar(ID)).resolves.toBeUndefined();
  });

  it('eliminar un accidente inexistente responde 404 sin tocar Storage', async () => {
    const { supabase, storageFrom } = crearSupabaseFalso({
      data: null,
      error: null,
    });
    const servicio = new AccidentesAseguradorService(supabase);

    await expect(servicio.eliminar(ID)).rejects.toThrow(NotFoundException);
    expect(storageFrom).not.toHaveBeenCalled();
  });
});
