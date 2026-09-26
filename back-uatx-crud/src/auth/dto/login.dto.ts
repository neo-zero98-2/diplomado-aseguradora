import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  // Correo, idContrato (asegurado) o idEmpleado (asegurador)
  @IsString()
  @IsNotEmpty()
  identificador: string;

  @IsString()
  @IsNotEmpty()
  contrasena: string;
}
