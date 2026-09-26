import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { aAsegurado, type Asegurado } from './asegurados.types.js';

@Injectable()
export class AseguradosService {
  constructor(private readonly supabase: SupabaseService) {}

  async listar(): Promise<Asegurado[]> {
    const { data, error } = await this.supabase.admin
      .from('asegurados')
      .select('*')
      .order('nombre');
    if (error) {
      throw new InternalServerErrorException('No se pudo listar asegurados');
    }
    return data.map(aAsegurado);
  }
}
