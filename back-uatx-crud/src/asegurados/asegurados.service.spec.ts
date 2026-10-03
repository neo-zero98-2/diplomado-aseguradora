import { ConflictException, NotFoundException } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service.js';
import { AseguradosService } from './asegurados.service.js';
import type { FilaAsegurado } from './asegurados.types.js';

const FILA: FilaAsegurado = {
  id: 'uuid-1',
  nombre: 'Juan Pérez',
  edad: 35,
  id_contrato: 'CTR-0001',
  fecha_vencimiento: '2030-12-31',
  fecha_registro: '2026-01-15',
  correo: 'juan@example.com',
};

const DTO_CREAR = {
  nombre: ' Ana Ruiz ',
  edad: 28,
  idContrato: 'CTR-0002',
  fechaVencimiento: '2031-06-30',
  correo: 'Ana.Ruiz@Example.com',
  contrasena: 'Clave123',
};

const DUPLICADO = { code: '23505', message: 'duplicate key value' };

type Resultado = { data: unknown; error: unknown };

// Consulta falsa de PostgREST: los métodos encadenables se registran y devuelven
// la misma consulta; los que la terminan (order, limit, single, maybeSingle) entregan `resultado`
function consulta(resultado: Resultado) {
  const llamadas: Record<string, unknown[]> = {};
  const q: any = {
    llamadas,
    order: async (...args: unknown[]) => {
      llamadas.order = args;
      return resultado;
    },
    limit: async (...args: unknown[]) => {
      llamadas.limit = args;
      return resultado;
    },
    single: async () => resultado,
    maybeSingle: async () => resultado,
  };
  for (const metodo of ['select', 'insert', 'update', 'eq', 'neq']) {
    q[metodo] = (...args: unknown[]) => {
      llamadas[metodo] = args;
      return q;
    };
  }
  return q;
}

// Cada llamada a from() consume la siguiente consulta de la lista
function crearSupabaseFalso(consultas: ReturnType<typeof consulta>[]) {
  const auth = {
    createUser: vi.fn(),
    updateUserById: vi.fn(async () => ({ data: {}, error: null })),
    deleteUser: vi.fn(async () => ({ data: {}, error: null })),
  };
  const from = vi.fn(() => {
    const siguiente = consultas.shift();
    if (!siguiente) throw new Error('from() llamado más veces de lo esperado');
    return siguiente;
  });
  const supabase = { admin: { from, auth: { admin: auth } } };
  return { supabase: supabase as unknown as SupabaseService, auth, from };
}

describe('AseguradosService', () => {
  describe('listar', () => {
    it('devuelve los asegurados en camelCase ordenados por nombre', async () => {
      const q = consulta({ data: [FILA], error: null });
      const { supabase } = crearSupabaseFalso([q]);

      const resultado = await new AseguradosService(supabase).listar();

      expect(q.llamadas.order).toEqual(['nombre']);
      expect(resultado).toEqual([
        {
          id: 'uuid-1',
          nombre: 'Juan Pérez',
          edad: 35,
          idContrato: 'CTR-0001',
          fechaVencimiento: '2030-12-31',
          fechaRegistro: '2026-01-15',
          correo: 'juan@example.com',
        },
      ]);
    });
  });

  describe('crear', () => {
    it('crea la cuenta confirmada e inserta la fila con el correo en minúsculas', async () => {
      const insert = consulta({
        data: { ...FILA, id: 'uuid-nuevo', correo: 'ana.ruiz@example.com' },
        error: null,
      });
      const { supabase, auth } = crearSupabaseFalso([insert]);
      auth.createUser.mockResolvedValue({
        data: { user: { id: 'uuid-nuevo' } },
        error: null,
      });

      const resultado = await new AseguradosService(supabase).crear(DTO_CREAR);

      expect(auth.createUser).toHaveBeenCalledWith({
        email: 'ana.ruiz@example.com',
        password: 'Clave123',
        email_confirm: true,
      });
      expect(insert.llamadas.insert).toEqual([
        {
          id: 'uuid-nuevo',
          nombre: 'Ana Ruiz',
          edad: 28,
          id_contrato: 'CTR-0002',
          fecha_vencimiento: '2031-06-30',
          correo: 'ana.ruiz@example.com',
        },
      ]);
      expect(resultado.id).toBe('uuid-nuevo');
      expect(auth.deleteUser).not.toHaveBeenCalled();
    });

    it('responde 409 si el correo ya existe en auth.users, sin insertar', async () => {
      const { supabase, auth, from } = crearSupabaseFalso([]);
      auth.createUser.mockResolvedValue({
        data: { user: null },
        error: { code: 'email_exists', status: 422 },
      });

      await expect(
        new AseguradosService(supabase).crear(DTO_CREAR),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(from).not.toHaveBeenCalled();
    });

    it('borra la cuenta recién creada y responde 409 si el insert choca con un duplicado', async () => {
      const insert = consulta({ data: null, error: DUPLICADO });
      const { supabase, auth } = crearSupabaseFalso([insert]);
      auth.createUser.mockResolvedValue({
        data: { user: { id: 'uuid-nuevo' } },
        error: null,
      });

      await expect(
        new AseguradosService(supabase).crear(DTO_CREAR),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(auth.deleteUser).toHaveBeenCalledWith('uuid-nuevo');
    });
  });

  describe('actualizar', () => {
    it('responde 404 si el asegurado no existe', async () => {
      const buscar = consulta({ data: null, error: null });
      const { supabase, auth } = crearSupabaseFalso([buscar]);

      await expect(
        new AseguradosService(supabase).actualizar('uuid-x', { nombre: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(auth.updateUserById).not.toHaveBeenCalled();
    });

    it('cambia el correo en auth.users y después en la fila', async () => {
      const buscar = consulta({ data: FILA, error: null });
      const libre = consulta({ data: null, error: null });
      const update = consulta({
        data: { ...FILA, correo: 'nuevo@example.com' },
        error: null,
      });
      const { supabase, auth } = crearSupabaseFalso([buscar, libre, update]);

      const resultado = await new AseguradosService(supabase).actualizar(
        'uuid-1',
        { correo: 'Nuevo@Example.com' },
      );

      expect(auth.updateUserById).toHaveBeenCalledTimes(1);
      expect(auth.updateUserById).toHaveBeenCalledWith('uuid-1', {
        email: 'nuevo@example.com',
        email_confirm: true,
      });
      expect(update.llamadas.update).toEqual([{ correo: 'nuevo@example.com' }]);
      expect(resultado.correo).toBe('nuevo@example.com');
    });

    it('responde 409 sin tocar auth.users si otro asegurado ya usa el correo', async () => {
      const buscar = consulta({ data: FILA, error: null });
      const ocupado = consulta({ data: { id: 'uuid-otro' }, error: null });
      const { supabase, auth } = crearSupabaseFalso([buscar, ocupado]);

      await expect(
        new AseguradosService(supabase).actualizar('uuid-1', {
          correo: 'otro@example.com',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(auth.updateUserById).not.toHaveBeenCalled();
    });

    it('revierte el correo en auth.users si falla el update de la fila', async () => {
      const buscar = consulta({ data: FILA, error: null });
      const libre = consulta({ data: null, error: null });
      const update = consulta({ data: null, error: DUPLICADO });
      const { supabase, auth } = crearSupabaseFalso([buscar, libre, update]);

      await expect(
        new AseguradosService(supabase).actualizar('uuid-1', {
          correo: 'nuevo@example.com',
          idContrato: 'CTR-REPETIDO',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(auth.updateUserById).toHaveBeenNthCalledWith(2, 'uuid-1', {
        email: 'juan@example.com',
        email_confirm: true,
      });
    });

    it('no toca auth.users si el correo no cambia', async () => {
      const buscar = consulta({ data: FILA, error: null });
      const update = consulta({ data: { ...FILA, edad: 36 }, error: null });
      const { supabase, auth } = crearSupabaseFalso([buscar, update]);

      await new AseguradosService(supabase).actualizar('uuid-1', {
        correo: 'juan@example.com',
        edad: 36,
      });

      expect(auth.updateUserById).not.toHaveBeenCalled();
    });
  });

  describe('eliminar', () => {
    it('responde 404 si el asegurado no existe, sin borrar cuentas', async () => {
      const buscar = consulta({ data: null, error: null });
      const { supabase, auth } = crearSupabaseFalso([buscar]);

      await expect(
        new AseguradosService(supabase).eliminar('uuid-x'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(auth.deleteUser).not.toHaveBeenCalled();
    });

    it('borra la cuenta de auth.users', async () => {
      const buscar = consulta({ data: FILA, error: null });
      const sinAccidentes = consulta({ data: [], error: null });
      const { supabase, auth } = crearSupabaseFalso([buscar, sinAccidentes]);

      await new AseguradosService(supabase).eliminar('uuid-1');

      expect(auth.deleteUser).toHaveBeenCalledWith('uuid-1');
    });

    it('responde 409 sin borrar la cuenta si el asegurado tiene accidentes', async () => {
      const buscar = consulta({ data: FILA, error: null });
      const conAccidentes = consulta({ data: [{ id: 'acc-1' }], error: null });
      const { supabase, auth, from } = crearSupabaseFalso([
        buscar,
        conAccidentes,
      ]);

      await expect(
        new AseguradosService(supabase).eliminar('uuid-1'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(from).toHaveBeenLastCalledWith('accidentes');
      expect(conAccidentes.llamadas.eq).toEqual(['asegurado_id', 'uuid-1']);
      expect(auth.deleteUser).not.toHaveBeenCalled();
    });
  });
});
