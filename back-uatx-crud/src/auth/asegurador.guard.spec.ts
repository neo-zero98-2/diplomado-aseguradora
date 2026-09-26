import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service.js';
import { AseguradorGuard } from './asegurador.guard.js';

const TOKENS: Record<string, string> = {
  'token-asegurado': 'uuid-asegurado',
  'token-asegurador': 'uuid-asegurador',
};

// Supabase falso: auth.getUser(token) y from('aseguradores').select().eq().maybeSingle()
function crearSupabaseFalso() {
  const aseguradores = [{ id: 'uuid-asegurador' }];

  const supabase = {
    admin: {
      auth: {
        getUser: async (token: string) => {
          const id = TOKENS[token];
          return id
            ? { data: { user: { id } }, error: null }
            : {
                data: { user: null },
                error: { status: 401, message: 'invalid JWT' },
              };
        },
      },
      from: () => ({
        select: () => ({
          eq: (_columna: string, valor: unknown) => ({
            maybeSingle: async () => ({
              data: aseguradores.find((f) => f.id === valor) ?? null,
              error: null,
            }),
          }),
        }),
      }),
    },
  };

  return supabase as unknown as SupabaseService;
}

function contextoCon(authorization?: string): ExecutionContext {
  const request = { headers: authorization ? { authorization } : {} };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AseguradorGuard', () => {
  let guard: AseguradorGuard;

  beforeEach(() => {
    guard = new AseguradorGuard(crearSupabaseFalso());
  });

  it('rechaza con 401 una petición sin header Authorization', async () => {
    await expect(guard.canActivate(contextoCon())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rechaza con 401 un header que no es Bearer', async () => {
    await expect(
      guard.canActivate(contextoCon('Basic token-asegurador')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza con 401 un token inválido', async () => {
    await expect(
      guard.canActivate(contextoCon('Bearer token-falso')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza con 403 el token de un asegurado', async () => {
    await expect(
      guard.canActivate(contextoCon('Bearer token-asegurado')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('permite el token de un asegurador', async () => {
    await expect(
      guard.canActivate(contextoCon('Bearer token-asegurador')),
    ).resolves.toBe(true);
  });
});
