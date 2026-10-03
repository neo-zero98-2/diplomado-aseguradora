import type { FunctionDeclaration } from '@google/genai';
import { GRAVEDADES, type Gravedad } from './constancia.js';
import type {
  AccidenteAsegurador,
  EstadoAccidente,
} from './accidentes.types.js';
import { ESTADOS_ACCIDENTE } from './dto/actualizar-accidente.dto.js';

// Herramientas de solo lectura que Gemini llama desde el chat del asegurador.
// Filtran y cuentan sobre la lista de accidentes ya cargada, así que los números
// los calcula el código y no la IA. Un argumento inválido no lanza: devuelve
// { error } para que Gemini lo lea y corrija la llamada

export const HERRAMIENTA_CONTAR = 'contar_accidentes';
export const HERRAMIENTA_BUSCAR = 'buscar_accidentes';
export const HERRAMIENTA_DETALLE = 'detalle_accidente';
export const HERRAMIENTA_RESPONDER = 'responder';

const LIMITE_POR_DEFECTO = 10;
const LIMITE_MAXIMO = 20;

export interface ErrorHerramienta {
  error: string;
}

export interface ConteoAccidentes {
  total: number;
  porEstado: Record<EstadoAccidente, number>;
}

export interface AccidenteEncontrado {
  id: string;
  estado: EstadoAccidente;
  gravedad: Gravedad;
  fechaHoraAccidente: string;
  fechaReporte: string;
  vehiculoMarca: string;
  vehiculoModelo: string;
  vehiculoPlacas: string;
  asegurado: { nombre: string; idContrato: string };
}

export interface ResultadoBusqueda {
  total: number; // coincidencias antes del límite
  accidentes: AccidenteEncontrado[];
}

interface FiltrosAccidentes {
  estado?: EstadoAccidente;
  gravedad?: Gravedad;
  desde?: string;
  hasta?: string;
  texto?: string;
}

const PROPIEDADES_FILTROS = {
  gravedad: { type: 'string', enum: GRAVEDADES },
  desde: {
    type: 'string',
    description:
      'Fecha inicial del accidente, YYYY-MM-DD, en la zona horaria del asegurador (incluida)',
  },
  hasta: {
    type: 'string',
    description:
      'Fecha final del accidente, YYYY-MM-DD, en la zona horaria del asegurador (incluida)',
  },
  texto: {
    type: 'string',
    description:
      'Nombre del asegurado, idContrato o placas; no distingue mayúsculas ni acentos',
  },
};

export const DECLARACIONES_HERRAMIENTAS: FunctionDeclaration[] = [
  {
    name: HERRAMIENTA_CONTAR,
    description:
      'Cuenta los accidentes que cumplen los filtros, en total y por estado (pendiente, en_revision, aprobado, rechazado).',
    parametersJsonSchema: {
      type: 'object',
      properties: PROPIEDADES_FILTROS,
    },
  },
  {
    name: HERRAMIENTA_BUSCAR,
    description:
      'Busca accidentes con los filtros y devuelve el total de coincidencias y los más recientes primero, con su asegurado (nombre e idContrato).',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        estado: { type: 'string', enum: ESTADOS_ACCIDENTE },
        ...PROPIEDADES_FILTROS,
        limite: {
          type: 'integer',
          description: `Cuántos accidentes devolver, de 1 a ${LIMITE_MAXIMO}; por defecto ${LIMITE_POR_DEFECTO}`,
        },
      },
    },
  },
  {
    name: HERRAMIENTA_DETALLE,
    description:
      'Devuelve el detalle completo de un accidente por su id: reporte, ubicación, vehículo, terceros, nota del asegurador y datos del asegurado.',
    parametersJsonSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: HERRAMIENTA_RESPONDER,
    description:
      'Termina el turno con la respuesta para el asegurador. Llámala siempre al final, una sola vez.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        mensaje: {
          type: 'string',
          description: 'Respuesta en español y en texto plano, sin Markdown',
        },
        accidentesIds: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Ids de los accidentes concretos que menciona la respuesta; vacío si no menciona ninguno',
        },
      },
      required: ['mensaje', 'accidentesIds'],
    },
  },
];

export function contarAccidentes(
  accidentes: AccidenteAsegurador[],
  args: unknown,
  zonaHoraria: string,
): ConteoAccidentes | ErrorHerramienta {
  const filtros = leerFiltros(args, false);
  if ('error' in filtros) return filtros;

  const porEstado = Object.fromEntries(
    ESTADOS_ACCIDENTE.map((estado) => [estado, 0]),
  ) as Record<EstadoAccidente, number>;
  const coincidencias = filtrar(accidentes, filtros, zonaHoraria);
  for (const accidente of coincidencias) {
    porEstado[accidente.estado]++;
  }
  return { total: coincidencias.length, porEstado };
}

export function buscarAccidentes(
  accidentes: AccidenteAsegurador[],
  args: unknown,
  zonaHoraria: string,
): ResultadoBusqueda | ErrorHerramienta {
  const filtros = leerFiltros(args, true);
  if ('error' in filtros) return filtros;

  const limite = (args as Record<string, unknown> | undefined)?.limite;
  if (
    limite !== undefined &&
    (!Number.isInteger(limite) ||
      (limite as number) < 1 ||
      (limite as number) > LIMITE_MAXIMO)
  ) {
    return { error: `limite debe ser un entero de 1 a ${LIMITE_MAXIMO}` };
  }

  const coincidencias = filtrar(accidentes, filtros, zonaHoraria).sort(
    (a, b) => Date.parse(b.fechaReporte) - Date.parse(a.fechaReporte),
  );
  return {
    total: coincidencias.length,
    accidentes: coincidencias
      .slice(0, (limite as number | undefined) ?? LIMITE_POR_DEFECTO)
      .map(aEncontrado),
  };
}

export function detalleAccidente(
  accidentes: AccidenteAsegurador[],
  args: unknown,
): AccidenteAsegurador | ErrorHerramienta {
  const id = (args as Record<string, unknown> | undefined)?.id;
  return (
    accidentes.find((accidente) => accidente.id === id) ?? {
      error: 'No existe un accidente con ese id',
    }
  );
}

// Valida los argumentos que mandó Gemini; `conEstado` solo para la búsqueda,
// porque el conteo ya separa por estado
function leerFiltros(
  args: unknown,
  conEstado: boolean,
): FiltrosAccidentes | ErrorHerramienta {
  const valores = (args ?? {}) as Record<string, unknown>;
  const filtros: FiltrosAccidentes = {};

  if (conEstado && valores.estado !== undefined) {
    if (!ESTADOS_ACCIDENTE.includes(valores.estado as EstadoAccidente)) {
      return {
        error: `estado debe ser uno de: ${ESTADOS_ACCIDENTE.join(', ')}`,
      };
    }
    filtros.estado = valores.estado as EstadoAccidente;
  }
  if (valores.gravedad !== undefined) {
    if (!GRAVEDADES.includes(valores.gravedad as Gravedad)) {
      return { error: `gravedad debe ser una de: ${GRAVEDADES.join(', ')}` };
    }
    filtros.gravedad = valores.gravedad as Gravedad;
  }
  for (const campo of ['desde', 'hasta'] as const) {
    if (valores[campo] === undefined) continue;
    if (!esFecha(valores[campo])) {
      return { error: `${campo} debe tener el formato YYYY-MM-DD` };
    }
    filtros[campo] = valores[campo];
  }
  if (valores.texto !== undefined) {
    if (typeof valores.texto !== 'string') {
      return { error: 'texto debe ser una cadena' };
    }
    if (valores.texto.trim()) {
      filtros.texto = valores.texto;
    }
  }
  return filtros;
}

function filtrar(
  accidentes: AccidenteAsegurador[],
  filtros: FiltrosAccidentes,
  zonaHoraria: string,
): AccidenteAsegurador[] {
  const texto = filtros.texto ? normalizar(filtros.texto) : null;
  const textoPlacas = filtros.texto ? compactar(filtros.texto) : null;

  return accidentes.filter((accidente) => {
    if (filtros.estado && accidente.estado !== filtros.estado) return false;
    if (filtros.gravedad && accidente.gravedad !== filtros.gravedad) {
      return false;
    }
    if (filtros.desde || filtros.hasta) {
      const dia = diaEnZona(accidente.fechaHoraAccidente, zonaHoraria);
      if (filtros.desde && dia < filtros.desde) return false;
      if (filtros.hasta && dia > filtros.hasta) return false;
    }
    if (texto) {
      const coincide =
        normalizar(accidente.asegurado.nombre).includes(texto) ||
        normalizar(accidente.asegurado.idContrato).includes(texto) ||
        // Las placas se comparan sin guiones ni espacios: "TLX123A" = "TLX-123-A"
        (!!textoPlacas &&
          compactar(accidente.vehiculoPlacas).includes(textoPlacas));
      if (!coincide) return false;
    }
    return true;
  });
}

function aEncontrado(accidente: AccidenteAsegurador): AccidenteEncontrado {
  return {
    id: accidente.id,
    estado: accidente.estado,
    gravedad: accidente.gravedad,
    fechaHoraAccidente: accidente.fechaHoraAccidente,
    fechaReporte: accidente.fechaReporte,
    vehiculoMarca: accidente.vehiculoMarca,
    vehiculoModelo: accidente.vehiculoModelo,
    vehiculoPlacas: accidente.vehiculoPlacas,
    asegurado: {
      nombre: accidente.asegurado.nombre,
      idContrato: accidente.asegurado.idContrato,
    },
  };
}

// Día 'YYYY-MM-DD' del instante en la zona horaria del asegurador; en-CA
// formatea las fechas justo así
function diaEnZona(iso: string, zonaHoraria: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function esFecha(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return false;
  }
  // Descarta fechas imposibles como 2026-02-30 o 2026-13-01
  const fecha = new Date(`${valor}T00:00:00Z`);
  return (
    !Number.isNaN(fecha.getTime()) && fecha.toISOString().startsWith(valor)
  );
}

// Minúsculas y sin acentos
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function compactar(texto: string): string {
  return normalizar(texto).replace(/[^a-z0-9]/g, '');
}
