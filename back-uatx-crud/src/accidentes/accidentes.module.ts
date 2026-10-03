import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { GeminiModule } from '../gemini/gemini.module.js';
import { SupabaseModule } from '../supabase/supabase.module.js';
import { AccidentesController } from './accidentes.controller.js';
import { AccidentesService } from './accidentes.service.js';

@Module({
  imports: [SupabaseModule, AuthModule, GeminiModule],
  controllers: [AccidentesController],
  providers: [AccidentesService],
})
export class AccidentesModule {}
