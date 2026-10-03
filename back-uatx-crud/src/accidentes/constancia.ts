import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export type Gravedad = 'leve' | 'moderado' | 'grave';

export const GRAVEDADES: readonly Gravedad[] = ['leve', 'moderado', 'grave'];

// Vigencia de una constancia desde el análisis de la foto
export const VIGENCIA_CONSTANCIA_MS = 60 * 60 * 1000;

// Contenido firmado con HMAC-SHA256 usando CONSTANCIA_SECRET
export interface ContenidoConstancia {
  aseguradoId: string;
  fotoSha256: string; // huella de los bytes exactos de la foto
  descripcion: string; // análisis de Gemini
  gravedad: Gravedad;
  expira: number; // epoch en ms; 1 hora después del análisis
}

// Lo que debe coincidir al confirmar el accidente
interface Esperado {
  aseguradoId: string;
  fotoSha256: string;
}

export function huellaSha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

// Formato: base64url(JSON del contenido) + "." + base64url(firma)
export function firmarConstancia(
  contenido: ContenidoConstancia,
  secreto: string,
): string {
  const cuerpo = Buffer.from(JSON.stringify(contenido)).toString('base64url');
  return `${cuerpo}.${firmar(cuerpo, secreto)}`;
}

// Devuelve el contenido si la firma es válida, no ha vencido y corresponde al
// asegurado y a la foto esperados; en cualquier otro caso devuelve null
export function verificarConstancia(
  constancia: string,
  esperado: Esperado,
  secreto: string,
  ahora = Date.now(),
): ContenidoConstancia | null {
  const partes = constancia.split('.');
  if (partes.length !== 2) return null;
  const [cuerpo, firma] = partes;

  const recibida = Buffer.from(firma, 'base64url');
  const calculada = Buffer.from(firmar(cuerpo, secreto), 'base64url');
  // timingSafeEqual exige la misma longitud; comparar longitudes no filtra la firma
  if (
    recibida.length !== calculada.length ||
    !timingSafeEqual(recibida, calculada)
  ) {
    return null;
  }

  const contenido = leerContenido(cuerpo);
  if (!contenido) return null;
  if (contenido.expira <= ahora) return null;
  if (contenido.aseguradoId !== esperado.aseguradoId) return null;
  if (contenido.fotoSha256 !== esperado.fotoSha256) return null;
  return contenido;
}

function firmar(cuerpo: string, secreto: string): string {
  return createHmac('sha256', secreto).update(cuerpo).digest('base64url');
}

function leerContenido(cuerpo: string): ContenidoConstancia | null {
  let json: any;
  try {
    json = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (
    typeof json?.aseguradoId !== 'string' ||
    typeof json.fotoSha256 !== 'string' ||
    typeof json.descripcion !== 'string' ||
    !GRAVEDADES.includes(json.gravedad) ||
    typeof json.expira !== 'number'
  ) {
    return null;
  }
  return json;
}
