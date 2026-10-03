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
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  AseguradorGuard,
  type PeticionAsegurador,
} from '../auth/asegurador.guard.js';
import { AccidentesAseguradorService } from './accidentes-asegurador.service.js';
import type {
  AccidenteAsegurador,
  FotoAccidente,
  RespuestaConsulta,
} from './accidentes.types.js';
import { ConsultaAseguradorService } from './consulta-asegurador.service.js';
import { ActualizarAccidenteDto } from './dto/actualizar-accidente.dto.js';
import { ConsultaAseguradorDto } from './dto/consulta-asegurador.dto.js';

// Comparte la ruta /accidentes con AccidentesController, que es del asegurado;
// aquí van solo los endpoints del asegurador
@Controller('accidentes')
@UseGuards(AseguradorGuard)
export class AccidentesAseguradorController {
  constructor(
    private readonly accidentesAseguradorService: AccidentesAseguradorService,
    private readonly consultaAseguradorService: ConsultaAseguradorService,
  ) {}

  @Get()
  listar(): Promise<AccidenteAsegurador[]> {
    return this.accidentesAseguradorService.listar();
  }

  // Un turno del chat de consulta: solo lee, por eso responde 200. No choca con
  // POST /accidentes del asegurado, que no lleva más segmentos
  @Post('consulta')
  @HttpCode(HttpStatus.OK)
  consultar(@Body() dto: ConsultaAseguradorDto): Promise<RespuestaConsulta> {
    return this.consultaAseguradorService.consultar(dto);
  }

  // AccidentesController va antes en AccidentesModule, así que GET
  // /accidentes/mios del asegurado no llega a esta ruta
  @Get(':id')
  obtener(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AccidenteAsegurador> {
    return this.accidentesAseguradorService.obtener(id);
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
