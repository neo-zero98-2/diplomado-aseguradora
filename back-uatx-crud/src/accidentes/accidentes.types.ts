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
