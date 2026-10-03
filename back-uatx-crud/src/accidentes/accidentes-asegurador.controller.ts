import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import type { AccidenteAsegurador, FotoAccidente } from './accidentes.types.js';
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

  @Get(':id/foto')
  obtenerFoto(@Param('id', ParseUUIDPipe) id: string): Promise<FotoAccidente> {
    return this.accidentesAseguradorService.obtenerFoto(id);
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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.accidentesAseguradorService.eliminar(id);
  }
}
