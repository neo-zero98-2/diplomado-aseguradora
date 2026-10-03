import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  AseguradoGuard,
  type PeticionAsegurado,
} from '../auth/asegurado.guard.js';
import { AccidentesService } from './accidentes.service.js';
import type {
  AccidenteCreado,
  AnalisisFoto,
  ArchivoFoto,
  RespuestaChat,
} from './accidentes.types.js';
import { ChatDto } from './dto/chat.dto.js';
import { leerCrearAccidenteDto } from './dto/crear-accidente.dto.js';
import { FotoDemasiadoGrandeFilter, opcionesFoto } from './foto.upload.js';

@Controller('accidentes')
@UseGuards(AseguradoGuard)
export class AccidentesController {
  constructor(private readonly accidentesService: AccidentesService) {}

  // multipart: foto (la misma que se analizó), constancia y datos (JSON).
  // @Post responde 201 por defecto
  @Post()
  @UseInterceptors(FileInterceptor('foto', opcionesFoto))
  @UseFilters(FotoDemasiadoGrandeFilter)
  async crear(
    @Req() request: PeticionAsegurado,
    @UploadedFile() foto: ArchivoFoto | undefined,
    @Body('constancia') constancia: unknown,
    @Body('datos') datos: unknown,
  ): Promise<AccidenteCreado> {
    if (!foto) {
      throw new BadRequestException('Falta la foto');
    }
    if (typeof constancia !== 'string' || !constancia) {
      throw new BadRequestException('Falta la constancia de la foto');
    }
    const dto = await leerCrearAccidenteDto(datos);
    return this.accidentesService.crear(
      request.aseguradoId,
      foto,
      constancia,
      dto,
    );
  }

  // Un turno de la entrevista: no crea nada, por eso responde 200
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  conversar(@Body() dto: ChatDto): Promise<RespuestaChat> {
    return this.accidentesService.conversar(dto);
  }

  // Solo analiza la foto: no guarda nada, por eso responde 200 y no 201
  @Post('foto')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('foto', opcionesFoto))
  @UseFilters(FotoDemasiadoGrandeFilter)
  analizarFoto(
    @Req() request: PeticionAsegurado,
    @UploadedFile() foto: ArchivoFoto | undefined,
  ): Promise<AnalisisFoto> {
    if (!foto) {
      throw new BadRequestException('Falta la foto');
    }
    return this.accidentesService.analizarFoto(request.aseguradoId, foto);
  }
}
