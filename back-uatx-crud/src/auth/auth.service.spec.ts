import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service.js';
import { AuthService } from './auth.service.js';

type Fila = Record<string, any>;

const ASEGURADO_ID = 'uuid-asegurado';
const ASEGURADOR_ID = 'uuid-asegurador';
const CONTRASENA = 'Prueba123!';

// Supabase falso en memoria: soporta from().select().eq().maybeSingle(),
// auth.admin.getUserById() y auth.signInWithPassword()
function crearSupabaseFalso(tablas: Record<string, Fila[]>) {
  const usuarios = [
    { id: ASEGURADO_ID, email: 'asegurado@example.com' },
    { id: ASEGURADOR_ID, email: 'asegurador@example.com' },
  ];

  const from = (tabla: string) => ({
    select: () => ({
      eq: (columna: string, valor: unknown) => ({
        maybeSingle: async () => ({
          data: tablas[tabla].find((f) => f[columna] === valor) ?? null,
          error: null,
        }),
      }),
    }),
  });

  const signInWithPassword = vi.fn(
    async ({ email, password }: { email: string; password: string }) => {
      const user = usuarios.find((u) => u.email === email);
      if (!user || password !== CONTRASENA) {
        return {
          data: { user: null, session: null },
          error: { status: 400, message: 'Invalid login credentials' },
        };
      }
      return {
        data: {
          user,
          session: {
            access_token: 'access-token',
            refresh_token: 'refresh-token',
          },
        },
        error: null,
      };
    },
  );

  const supabase = {
    anon: { auth: { signInWithPassword } },
    admin: {
      from,
      auth: {
        admin: {
          getUserById: async (id: string) => ({
            data: { user: usuarios.find((u) => u.id === id) ?? null },
            error: null,
          }),
        },
      },
    },
  };

  return {
    supabase: supabase as unknown as SupabaseService,
    signInWithPassword,
  };
}

describe('AuthService', () => {
  let tablas: Record<string, Fila[]>;
  let service: AuthService;
  let signInWithPassword: ReturnType<
    typeof crearSupabaseFalso
  >['signInWithPassword'];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 26)); // 2026-09-26, hora local

    tablas = {
      asegurados: [
        {
          id: ASEGURADO_ID,
          nombre: 'Juan Pérez',
          edad: 35,
          id_contrato: 'CTR-0001',
          fecha_vencimiento: '2027-12-31',
          fecha_registro: '2026-09-26',
          correo: 'asegurado@example.com',
        },
      ],
      aseguradores: [
        {
          id: ASEGURADOR_ID,
          nombre: 'María López',
          edad: 42,
          id_empleado: 'EMP-0001',
        },
      ],
    };

    const falso = crearSupabaseFalso(tablas);
    signInWithPassword = falso.signInWithPassword;
    service = new AuthService(falso.supabase);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('inicia sesión de un asegurado por correo', async () => {
    const res = await service.login({
      identificador: 'asegurado@example.com',
      contrasena: CONTRASENA,
    });

    expect(res).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      perfil: {
        rol: 'asegurado',
        nombre: 'Juan Pérez',
        edad: 35,
        idContrato: 'CTR-0001',
        fechaVencimiento: '2027-12-31',
        fechaRegistro: '2026-09-26',
        correo: 'asegurado@example.com',
      },
    });
  });

  it('inicia sesión de un asegurado por idContrato con la misma respuesta que por correo', async () => {
    const porCorreo = await service.login({
      identificador: 'asegurado@example.com',
      contrasena: CONTRASENA,
    });
    const porContrato = await service.login({
      identificador: 'CTR-0001',
      contrasena: CONTRASENA,
    });

    expect(porContrato).toEqual(porCorreo);
    expect(signInWithPassword).toHaveBeenLastCalledWith({
      email: 'asegurado@example.com',
      password: CONTRASENA,
    });
  });

  it('inicia sesión de un asegurador por idEmpleado', async () => {
    const res = await service.login({
      identificador: 'EMP-0001',
      contrasena: CONTRASENA,
    });

    expect(res.perfil).toEqual({
      rol: 'asegurador',
      nombre: 'María López',
      edad: 42,
      idEmpleado: 'EMP-0001',
      correo: 'asegurador@example.com',
    });
  });

  it('rechaza con 403 a un asegurado con contrato vencido sin crear sesión', async () => {
    tablas.asegurados[0].fecha_vencimiento = '2026-09-25';

    await expect(
      service.login({ identificador: 'CTR-0001', contrasena: CONTRASENA }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.login({
        identificador: 'asegurado@example.com',
        contrasena: CONTRASENA,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('permite el login el mismo día del vencimiento', async () => {
    tablas.asegurados[0].fecha_vencimiento = '2026-09-26';

    const res = await service.login({
      identificador: 'CTR-0001',
      contrasena: CONTRASENA,
    });

    expect(res.perfil.rol).toBe('asegurado');
  });

  it('rechaza con 401 una contraseña incorrecta', async () => {
    await expect(
      service.login({ identificador: 'CTR-0001', contrasena: 'mala' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza con 401 un identificador inexistente sin llamar a Supabase Auth', async () => {
    await expect(
      service.login({ identificador: 'XXX-9', contrasena: CONTRASENA }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});
