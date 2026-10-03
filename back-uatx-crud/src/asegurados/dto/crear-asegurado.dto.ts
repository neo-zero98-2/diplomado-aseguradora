import {
  IsEmail,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsPositive,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class CrearAseguradoDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsInt()
  @IsPositive()
  edad: number;

  @IsString()
  @IsNotEmpty()
  idContrato: string;

  // Solo fecha, sin hora: 'YYYY-MM-DD'
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaVencimiento debe tener el formato YYYY-MM-DD',
  })
  fechaVencimiento: string;

  @IsEmail()
  correo: string;

  // Mínimo por defecto de Supabase Auth
  @IsString()
  @MinLength(6)
  contrasena: string;
}
