import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AseguradorGuard } from '../auth/asegurador.guard.js';
import { AseguradosService } from './asegurados.service.js';
import type { Asegurado } from './asegurados.types.js';
import { ActualizarAseguradoDto } from './dto/actualizar-asegurado.dto.js';
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

  @Patch(':id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarAseguradoDto,
  ): Promise<Asegurado> {
    return this.aseguradosService.actualizar(id, dto);
  }
}
