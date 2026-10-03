import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  AseguradorGuard,
  type PeticionAsegurador,
} from '../auth/asegurador.guard.js';
import { AccidentesAseguradorService } from './accidentes-asegurador.service.js';
import type { AccidenteAsegurador } from './accidentes.types.js';
import { ActualizarAccidenteDto } from './dto/actualizar-accidente.dto.js';

// Comparte la ruta /accidentes con AccidentesController, que es del asegurado;
// aquí van solo los endpoints del asegurador
@Controller('accidentes')
@UseGuards(AseguradorGuard)
export class AccidentesAseguradorController {
  constructor(
    private readonly accidentesAseguradorService: AccidentesAseguradorService,
  ) {}

  @Get()
  listar(): Promise<AccidenteAsegurador[]> {
    return this.accidentesAseguradorService.listar();
  }

  @Patch(':id')
  actualizar(
    @Req() request: PeticionAsegurador,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarAccidenteDto,
  ): Promise<AccidenteAsegurador> {
    return this.accidentesAseguradorService.actualizar(
      id,
      request.aseguradorId,
      dto,
    );
  }
}
