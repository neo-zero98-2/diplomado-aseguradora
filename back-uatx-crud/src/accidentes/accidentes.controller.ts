import {
  BadRequestException,
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
import type { AnalisisFoto, ArchivoFoto } from './accidentes.types.js';
import { FotoDemasiadoGrandeFilter, opcionesFoto } from './foto.upload.js';

@Controller('accidentes')
@UseGuards(AseguradoGuard)
export class AccidentesController {
  constructor(private readonly accidentesService: AccidentesService) {}

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
