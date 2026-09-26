import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';

// Permite el paso solo a peticiones con un access token válido de Supabase
// cuyo usuario exista en la tabla aseguradores
@Injectable()
export class AseguradorGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = extraerToken(request.headers?.authorization);
    if (!token) {
      throw new UnauthorizedException('Falta el token de acceso');
    }

    const { data, error } = await this.supabase.admin.auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    const { data: asegurador } = await this.supabase.admin
      .from('aseguradores')
      .select('id')
      .eq('id', data.user.id)
      .maybeSingle();
    if (!asegurador) {
      throw new ForbiddenException('Solo un asegurador puede hacer esto');
    }

    return true;
  }
}

function extraerToken(header: unknown): string | null {
  if (typeof header !== 'string') return null;
  const [tipo, token] = header.split(' ');
  return tipo === 'Bearer' && token ? token : null;
}
