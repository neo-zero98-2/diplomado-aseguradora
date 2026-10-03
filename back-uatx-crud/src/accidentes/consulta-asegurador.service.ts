import { BadGatewayException, Injectable } from '@nestjs/common';
import { GEMINI_FALLO, GeminiService } from '../gemini/gemini.service.js';
import { AccidentesAseguradorService } from './accidentes-asegurador.service.js';
import type {
  AccidenteAsegurador,
  AccidenteMencionado,
  RespuestaConsulta,
} from './accidentes.types.js';
import type { ConsultaAseguradorDto } from './dto/consulta-asegurador.dto.js';
import {
  buscarAccidentes,
  contarAccidentes,
  DECLARACIONES_HERRAMIENTAS,
  detalleAccidente,
  HERRAMIENTA_BUSCAR,
  HERRAMIENTA_CONTAR,
  HERRAMIENTA_DETALLE,
  HERRAMIENTA_RESPONDER,
} from './herramientas-asegurador.js';
import {
  instruccionesConsulta,
  MAXIMO_MENCIONADOS,
} from './prompt-asegurador.js';

// Rondas de herramientas por turno antes de responder 502
const MAXIMO_RONDAS = 5;

// Chat de solo lectura del asegurador: Gemini decide qué herramientas llamar y
// aquí se ejecutan sobre la lista de accidentes. No guarda nada
@Injectable()
export class ConsultaAseguradorService {
  constructor(
    private readonly gemini: GeminiService,
    private readonly accidentesAsegurador: AccidentesAseguradorService,
  ) {}

  async consultar(dto: ConsultaAseguradorDto): Promise<RespuestaConsulta> {
    // La lista se pide la primera vez que hace falta y se reutiliza en el
    // resto del turno: todas las herramientas ven los mismos datos
    let lista: Promise<AccidenteAsegurador[]> | undefined;
    const accidentes = () => (lista ??= this.accidentesAsegurador.listar());

    const respuesta = await this.gemini.conversarConHerramientas({
      instrucciones: instruccionesConsulta(new Date(), dto.zonaHoraria),
      mensajes: dto.mensajes,
      herramientas: DECLARACIONES_HERRAMIENTAS,
      herramientaFinal: HERRAMIENTA_RESPONDER,
      maxRondas: MAXIMO_RONDAS,
      ejecutar: async (nombre, args) => {
        switch (nombre) {
          case HERRAMIENTA_CONTAR:
            return contarAccidentes(await accidentes(), args, dto.zonaHoraria);
          case HERRAMIENTA_BUSCAR:
            return buscarAccidentes(await accidentes(), args, dto.zonaHoraria);
          case HERRAMIENTA_DETALLE:
            return detalleAccidente(await accidentes(), args);
          default:
            return { error: `No existe la herramienta ${nombre}` };
        }
      },
    });

    const mensaje =
      typeof respuesta.mensaje === 'string' ? respuesta.mensaje.trim() : '';
    if (!mensaje) {
      throw new BadGatewayException(GEMINI_FALLO);
    }

    // La lista "Ver" se arma con datos de la base: los ids que no existen se
    // descartan y los repetidos se quitan
    const ids = Array.isArray(respuesta.accidentesIds)
      ? [
          ...new Set(
            respuesta.accidentesIds.filter(
              (id): id is string => typeof id === 'string',
            ),
          ),
        ]
      : [];
    let mencionados: AccidenteMencionado[] = [];
    if (ids.length > 0) {
      const porId = new Map((await accidentes()).map((a) => [a.id, a]));
      mencionados = ids
        .map((id) => porId.get(id))
        .filter((a): a is AccidenteAsegurador => a !== undefined)
        .slice(0, MAXIMO_MENCIONADOS)
        .map(aMencionado);
    }

    return { mensaje, accidentes: mencionados };
  }
}

function aMencionado(accidente: AccidenteAsegurador): AccidenteMencionado {
  return {
    id: accidente.id,
    aseguradoNombre: accidente.asegurado.nombre,
    vehiculoPlacas: accidente.vehiculoPlacas,
    estado: accidente.estado,
    gravedad: accidente.gravedad,
    fechaHoraAccidente: accidente.fechaHoraAccidente,
  };
}
