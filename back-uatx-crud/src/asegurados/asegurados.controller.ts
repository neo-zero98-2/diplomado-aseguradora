import { Controller, Get, UseGuards } from '@nestjs/common';
import { AseguradorGuard } from '../auth/asegurador.guard.js';
import { AseguradosService } from './asegurados.service.js';
import type { Asegurado } from './asegurados.types.js';

@Controller('asegurados')
@UseGuards(AseguradorGuard)
export class AseguradosController {
  constructor(private readonly aseguradosService: AseguradosService) {}

  @Get()
  listar(): Promise<Asegurado[]> {
    return this.aseguradosService.listar();
  }
}
