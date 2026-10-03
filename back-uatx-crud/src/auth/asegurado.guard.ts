import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { extraerToken } from './asegurador.guard.js';

// Petición que ya pasó por AseguradoGuard: trae el id del asegurado del token
export interface PeticionAsegurado {
  aseguradoId: string;
}

// Permite el paso solo a peticiones con un access token válido de Supabase
// cuyo usuario exista en la tabla asegurados; deja su id en request.aseguradoId
@Injectable()
export class AseguradoGuard implements CanActivate {
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

    const { data: asegurado } = await this.supabase.admin
      .from('asegurados')
      .select('id')
      .eq('id', data.user.id)
      .maybeSingle();
    if (!asegurado) {
      throw new ForbiddenException('Solo un asegurado puede hacer esto');
    }

    request.aseguradoId = asegurado.id;
    return true;
  }
}
