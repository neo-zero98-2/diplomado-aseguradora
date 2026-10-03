import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  ValidateBy,
  ValidateNested,
} from 'class-validator';
import { MAXIMO_MENSAJES, MensajeChatDto } from './chat.dto.js';

// El turno lo dispara una pregunta: el historial termina con el usuario
function UltimoMensajeDelUsuario() {
  return ValidateBy({
    name: 'ultimoMensajeDelUsuario',
    validator: {
      validate: (mensajes: unknown) =>
        Array.isArray(mensajes) && mensajes.at(-1)?.rol === 'usuario',
      defaultMessage: () => 'El último mensaje debe ser del usuario',
    },
  });
}

// Zona IANA que reconoce Intl, p. ej. 'America/Mexico_City'
function EsZonaHoraria() {
  return ValidateBy({
    name: 'esZonaHoraria',
    validator: {
      validate: (zona: unknown) => {
        if (typeof zona !== 'string' || !zona) return false;
        try {
          new Intl.DateTimeFormat('es-MX', { timeZone: zona });
          return true;
        } catch {
          return false;
        }
      },
      defaultMessage: () => 'zonaHoraria no es una zona horaria válida',
    },
  });
}

// Body de POST /accidentes/consulta: el historial completo del chat del
// asegurador, sin el saludo ni las sugerencias, y la zona del navegador
export class ConsultaAseguradorDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAXIMO_MENSAJES)
  @ValidateNested({ each: true })
  @Type(() => MensajeChatDto)
  @UltimoMensajeDelUsuario()
  mensajes: MensajeChatDto[];

  @IsString()
  @EsZonaHoraria()
  zonaHoraria: string;
}
