import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SupabaseModule } from '../supabase/supabase.module.js';
import { AseguradosController } from './asegurados.controller.js';
import { AseguradosService } from './asegurados.service.js';

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [AseguradosController],
  providers: [AseguradosService],
})
export class AseguradosModule {}
