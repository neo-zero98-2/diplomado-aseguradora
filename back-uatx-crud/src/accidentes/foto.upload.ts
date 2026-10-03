import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface.js';

export const TAMANO_MAXIMO_FOTO = 5 * 1024 * 1024;
export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];

// Opciones de FileInterceptor para el campo "foto": en memoria, 5 MB y JPEG/PNG/WebP
export const opcionesFoto: MulterOptions = {
  limits: { fileSize: TAMANO_MAXIMO_FOTO, files: 1 },
  fileFilter: (_req, archivo, callback) => {
    if (!TIPOS_FOTO.includes(archivo.mimetype)) {
      callback(
        new BadRequestException('La foto debe ser JPEG, PNG o WebP'),
        false,
      );
      return;
    }
    callback(null, true);
  },
};

// Multer convierte el exceso de tamaño en 413; la API responde 400
@Catch(PayloadTooLargeException)
export class FotoDemasiadoGrandeFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost): void {
    const error = new BadRequestException('La foto debe pesar máximo 5 MB');
    host
      .switchToHttp()
      .getResponse()
      .status(error.getStatus())
      .json(error.getResponse());
  }
}
