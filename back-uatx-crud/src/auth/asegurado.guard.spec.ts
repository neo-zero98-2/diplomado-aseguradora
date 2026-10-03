import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service.js';
import { AseguradoGuard } from './asegurado.guard.js';

const TOKENS: Record<string, string> = {
  'token-asegurado': 'uuid-asegurado',
  'token-asegurador': 'uuid-asegurador',
};

// Supabase falso: auth.getUser(token) y from('asegurados').select().eq().maybeSingle()
function crearSupabaseFalso() {
  const asegurados = [{ id: 'uuid-asegurado' }];

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
              data: asegurados.find((f) => f.id === valor) ?? null,
              error: null,
            }),
          }),
        }),
      }),
    },
  };

  return supabase as unknown as SupabaseService;
}

function contextoCon(authorization?: string) {
  const request: Record<string, any> = {
    headers: authorization ? { authorization } : {},
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('AseguradoGuard', () => {
  let guard: AseguradoGuard;

  beforeEach(() => {
    guard = new AseguradoGuard(crearSupabaseFalso());
  });

  it('rechaza con 401 una petición sin header Authorization', async () => {
    await expect(
      guard.canActivate(contextoCon().context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza con 401 un token inválido', async () => {
    await expect(
      guard.canActivate(contextoCon('Bearer token-falso').context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza con 403 el token de un asegurador', async () => {
    await expect(
      guard.canActivate(contextoCon('Bearer token-asegurador').context),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('permite el token de un asegurado y deja su id en la petición', async () => {
    const { context, request } = contextoCon('Bearer token-asegurado');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.aseguradoId).toBe('uuid-asegurado');
  });
});
