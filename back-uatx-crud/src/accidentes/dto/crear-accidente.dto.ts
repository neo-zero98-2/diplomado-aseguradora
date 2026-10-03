import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  IsBoolean,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import type { DatosAccidente } from '../accidentes.types.js';

const MAXIMO_TEXTO = 2000;

// Campo "datos" de POST /accidentes. foto_descripcion y gravedad no vienen
// aquí: se toman de la constancia verificada
export class CrearAccidenteDto implements DatosAccidente {
  @IsBoolean()
  aseguradoBien: boolean;

  @IsISO8601()
  fechaHoraAccidente: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAXIMO_TEXTO)
  resumen: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAXIMO_TEXTO)
  direccion?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  vehiculoMarca: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  vehiculoModelo: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  vehiculoPlacas: string;

  @IsBoolean()
  hayTerceros: boolean;

  // Obligatoria solo si hubo terceros
  @ValidateIf((dto: CrearAccidenteDto) => dto.hayTerceros === true)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAXIMO_TEXTO)
  tercerosDescripcion?: string;

  // Latitud y longitud van juntas o no van
  @ValidateIf((dto: CrearAccidenteDto) => dto.longitud !== undefined)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitud?: number;

  @ValidateIf((dto: CrearAccidenteDto) => dto.latitud !== undefined)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitud?: number;
}

const validacion = new ValidationPipe({ whitelist: true });

// En multipart el campo "datos" llega como texto JSON y el ValidationPipe
// global no lo valida; se parsea y valida aquí con las mismas reglas
export async function leerCrearAccidenteDto(
  json: unknown,
): Promise<CrearAccidenteDto> {
  if (typeof json !== 'string') {
    throw new BadRequestException('Faltan los datos del accidente');
  }
  let datos: unknown;
  try {
    datos = JSON.parse(json);
  } catch {
    throw new BadRequestException('Los datos del accidente no son JSON válido');
  }
  if (typeof datos !== 'object' || datos === null || Array.isArray(datos)) {
    throw new BadRequestException('Los datos del accidente no son válidos');
  }
  return validacion.transform(datos, {
    type: 'body',
    metatype: CrearAccidenteDto,
  });
}
