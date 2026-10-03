import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

// Límites para que el historial que se manda en cada turno no crezca sin control
export const MAXIMO_MENSAJES = 40;
export const MAXIMO_CARACTERES = 2000;

export type RolMensaje = 'usuario' | 'asistente';

export class MensajeChatDto {
  @IsIn(['usuario', 'asistente'])
  rol: RolMensaje;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAXIMO_CARACTERES)
  texto: string;
}

export class ChatDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAXIMO_MENSAJES)
  @ValidateNested({ each: true })
  @Type(() => MensajeChatDto)
  mensajes: MensajeChatDto[];
}
