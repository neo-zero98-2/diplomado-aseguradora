import type { Gravedad } from './constancia.js';

// Archivo recibido por FileInterceptor (multer en memoria)
export interface ArchivoFoto {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

// Respuesta de POST /accidentes/foto; no guarda nada
export type AnalisisFoto =
  | {
      procede: true;
      descripcion: string;
      gravedad: Gravedad;
      constancia: string;
    }
  | { procede: false; mensaje: string };

// Datos que reúne la entrevista (camelCase en la API, snake_case en la tabla)
export interface DatosAccidente {
  aseguradoBien: boolean;
  fechaHoraAccidente: string; // ISO 8601
  resumen: string;
  direccion?: string; // si no hubo GPS
  vehiculoMarca: string;
  vehiculoModelo: string;
  vehiculoPlacas: string;
  hayTerceros: boolean;
  tercerosDescripcion?: string;
}

// Respuesta de POST /accidentes
export interface AccidenteCreado {
  id: string;
  estado: 'pendiente';
}

export type EstadoAccidente =
  'pendiente' | 'en_revision' | 'aprobado' | 'rechazado';

// Elemento de GET /accidentes/mios (asegurado)
export interface MiAccidente {
  id: string;
  fechaHoraAccidente: string;
  vehiculoMarca: string;
  vehiculoModelo: string;
  vehiculoPlacas: string;
  gravedad: Gravedad;
  estado: EstadoAccidente;
  notaAsegurador: string | null;
}

export type EtapaChat = 'entrevista' | 'confirmacion';

// Respuesta de POST /accidentes/chat
export interface RespuestaChat {
  mensaje: string;
  etapa: EtapaChat; // 'confirmacion' solo cuando ya están todos los datos
  sugerir911: boolean;
  datos: Partial<DatosAccidente>;
}
