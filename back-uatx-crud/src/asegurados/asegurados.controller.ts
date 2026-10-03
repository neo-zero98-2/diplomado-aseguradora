import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AseguradorGuard } from '../auth/asegurador.guard.js';
import { AseguradosService } from './asegurados.service.js';
import type { Asegurado } from './asegurados.types.js';
import { CrearAseguradoDto } from './dto/crear-asegurado.dto.js';

@Controller('asegurados')
@UseGuards(AseguradorGuard)
export class AseguradosController {
  constructor(private readonly aseguradosService: AseguradosService) {}

  @Get()
  listar(): Promise<Asegurado[]> {
    return this.aseguradosService.listar();
  }

  // @Post responde 201 por defecto
  @Post()
  crear(@Body() dto: CrearAseguradoDto): Promise<Asegurado> {
    return this.aseguradosService.crear(dto);
  }
}
