import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  // Cliente anon: autenticación de usuarios (signInWithPassword)
  readonly anon: SupabaseClient;
  // Cliente service-role: búsquedas previas al login (omite RLS). Solo servidor.
  readonly admin: SupabaseClient;

  constructor() {
    const url = requireEnv('SUPABASE_URL');
    const options = {
      auth: { persistSession: false, autoRefreshToken: false },
    };

    this.anon = createClient(url, requireEnv('SUPABASE_ANON_KEY'), options);
    this.admin = createClient(
      url,
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      options,
    );
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}
