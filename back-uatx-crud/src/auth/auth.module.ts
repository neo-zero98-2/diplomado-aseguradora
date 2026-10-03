import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module.js';
import { AseguradoGuard } from './asegurado.guard.js';
import { AseguradorGuard } from './asegurador.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [SupabaseModule],
  controllers: [AuthController],
  providers: [AuthService, AseguradorGuard, AseguradoGuard],
  exports: [AseguradorGuard, AseguradoGuard],
})
export class AuthModule {}
