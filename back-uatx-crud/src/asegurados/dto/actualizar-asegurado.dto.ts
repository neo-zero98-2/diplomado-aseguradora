import {
  IsEmail,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
} from 'class-validator';

// Mismos campos que CrearAseguradoDto, sin contrasena y todos opcionales
export class ActualizarAseguradoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nombre?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  edad?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  idContrato?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaVencimiento debe tener el formato YYYY-MM-DD',
  })
  fechaVencimiento?: string;

  @IsOptional()
  @IsEmail()
  correo?: string;
}
