import {
  BadGatewayException,
  BadRequestException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { GeminiService } from '../gemini/gemini.service.js';
import type { SupabaseService } from '../supabase/supabase.service.js';
import {
  AccidentesService,
  BUCKET_FOTOS,
  CONSTANCIA_INVALIDA,
} from './accidentes.service.js';
import type { ArchivoFoto } from './accidentes.types.js';
import {
  firmarConstancia,
  huellaSha256,
  verificarConstancia,
} from './constancia.js';
import type { CrearAccidenteDto } from './dto/crear-accidente.dto.js';

const SECRETO = 'secreto-de-prueba';
const ASEGURADO = 'asegurado-1';

const FOTO: ArchivoFoto = {
  buffer: Buffer.from('bytes de la foto del choque'),
  mimetype: 'image/jpeg',
  size: 27,
};

const DATOS: CrearAccidenteDto = {
  aseguradoBien: true,
  fechaHoraAccidente: '2026-10-03T17:30:00-06:00',
  resumen: ' Choque por alcance en un semáforo. ',
  vehiculoMarca: 'Nissan',
  vehiculoModelo: 'Versa 2020',
  vehiculoPlacas: 'TLX-123-A',
  hayTerceros: true,
  tercerosDescripcion: 'Taxi conducido por Juan Pérez',
  latitud: 19.31,
  longitud: -98.24,
};

const DATOS_COMPLETOS = {
  aseguradoBien: true,
  fechaHoraAccidente: '2026-10-03T17:30:00-06:00',
  resumen: 'Choque por alcance',
  vehiculoMarca: 'Nissan',
  vehiculoModelo: 'Versa',
  vehiculoPlacas: 'TLX-123-A',
  hayTerceros: false,
};

function constanciaPara(
  foto: ArchivoFoto = FOTO,
  aseguradoId = ASEGURADO,
  expira = Date.now() + 60_000,
): string {
  return firmarConstancia(
    {
      aseguradoId,
      fotoSha256: huellaSha256(foto.buffer),
      descripcion: 'Dos autos con daños en la defensa',
      gravedad: 'moderado',
      expira,
    },
    SECRETO,
  );
}

// Supabase falso: Storage (upload/remove) y el insert de accidentes
function crearSupabaseFalso(
  resultadoInsert: { data: unknown; error: unknown } = {
    data: { id: 'accidente-1', estado: 'pendiente' },
    error: null,
  },
) {
  const fotos = {
    upload: vi.fn(async () => ({ data: {}, error: null })),
    remove: vi.fn(async () => ({ data: [], error: null })),
  };
  const insert = vi.fn(() => ({
    select: () => ({ single: async () => resultadoInsert }),
  }));
  const from = vi.fn(() => ({ insert }));
  const storageFrom = vi.fn(() => fotos);
  const supabase = { admin: { from, storage: { from: storageFrom } } };
  return {
    supabase: supabase as unknown as SupabaseService,
    fotos,
    insert,
    storageFrom,
  };
}

function crearGeminiFalso() {
  const gemini = { analizarFoto: vi.fn(), conversar: vi.fn() };
  return { gemini: gemini as unknown as GeminiService, ...gemini };
}

function crearServicio(supabaseFalso = crearSupabaseFalso()) {
  const geminiFalso = crearGeminiFalso();
  const servicio = new AccidentesService(
    geminiFalso.gemini,
    supabaseFalso.supabase,
  );
  return { servicio, ...supabaseFalso, ...geminiFalso };
}

describe('AccidentesService', () => {
  beforeEach(() => {
    vi.stubEnv('CONSTANCIA_SECRET', SECRETO);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('analizarFoto', () => {
    it('si procede, devuelve el análisis y una constancia de esa foto y ese asegurado', async () => {
      const { servicio, analizarFoto } = crearServicio();
      analizarFoto.mockResolvedValue({
        esAccidente: true,
        descripcion: 'Dos autos chocados',
        gravedad: 'grave',
      });

      const resultado = await servicio.analizarFoto(ASEGURADO, FOTO);

      expect(analizarFoto).toHaveBeenCalledWith(FOTO.buffer, 'image/jpeg');
      expect(resultado).toMatchObject({
        procede: true,
        descripcion: 'Dos autos chocados',
        gravedad: 'grave',
      });
      const constancia = (resultado as { constancia: string }).constancia;
      expect(
        verificarConstancia(
          constancia,
          { aseguradoId: ASEGURADO, fotoSha256: huellaSha256(FOTO.buffer) },
          SECRETO,
        ),
      ).toMatchObject({ descripcion: 'Dos autos chocados', gravedad: 'grave' });
    });

    it('si no procede, devuelve el mensaje "No procede" sin constancia', async () => {
      const { servicio, analizarFoto } = crearServicio();
      analizarFoto.mockResolvedValue({
        esAccidente: false,
        descripcion: 'Un paisaje con montañas.',
        gravedad: 'leve',
      });

      const resultado = await servicio.analizarFoto(ASEGURADO, FOTO);

      expect(resultado).toEqual({
        procede: false,
        mensaje:
          'No procede: la foto no muestra un accidente vehicular. Un paisaje con montañas.',
      });
      expect(resultado).not.toHaveProperty('constancia');
    });

    it('sin CONSTANCIA_SECRET responde 503 sin llamar a Gemini', async () => {
      vi.stubEnv('CONSTANCIA_SECRET', '');
      const { servicio, analizarFoto } = crearServicio();

      await expect(servicio.analizarFoto(ASEGURADO, FOTO)).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(analizarFoto).not.toHaveBeenCalled();
    });

    it('no sube nada a Storage', async () => {
      const { servicio, analizarFoto, storageFrom } = crearServicio();
      analizarFoto.mockResolvedValue({
        esAccidente: true,
        descripcion: 'Choque',
        gravedad: 'leve',
      });

      await servicio.analizarFoto(ASEGURADO, FOTO);

      expect(storageFrom).not.toHaveBeenCalled();
    });
  });

  describe('crear', () => {
    it('sube la foto e inserta el accidente pendiente con el análisis de la constancia', async () => {
      const { servicio, fotos, insert } = crearServicio();

      const resultado = await servicio.crear(
        ASEGURADO,
        FOTO,
        constanciaPara(),
        DATOS,
      );

      expect(resultado).toEqual({ id: 'accidente-1', estado: 'pendiente' });
      const [ruta, bytes, opciones] = fotos.upload.mock.calls[0] as any[];
      expect(ruta).toMatch(new RegExp(`^${ASEGURADO}/[0-9a-f-]{36}\\.jpg$`));
      expect(bytes).toBe(FOTO.buffer);
      expect(opciones).toMatchObject({
        contentType: 'image/jpeg',
        upsert: false,
      });
      expect(insert).toHaveBeenCalledWith({
        asegurado_id: ASEGURADO,
        estado: 'pendiente',
        fecha_hora_accidente: '2026-10-03T17:30:00-06:00',
        resumen: 'Choque por alcance en un semáforo.',
        asegurado_bien: true,
        latitud: 19.31,
        longitud: -98.24,
        direccion: null,
        vehiculo_marca: 'Nissan',
        vehiculo_modelo: 'Versa 2020',
        vehiculo_placas: 'TLX-123-A',
        hay_terceros: true,
        terceros_descripcion: 'Taxi conducido por Juan Pérez',
        foto_path: ruta,
        foto_descripcion: 'Dos autos con daños en la defensa',
        gravedad: 'moderado',
      });
      expect(fotos.remove).not.toHaveBeenCalled();
    });

    it('acepta la dirección escrita en lugar de coordenadas', async () => {
      const { servicio, insert } = crearServicio();
      const { latitud: _lat, longitud: _lon, ...sinGps } = DATOS;

      await servicio.crear(ASEGURADO, FOTO, constanciaPara(), {
        ...sinGps,
        direccion: 'Calle 5, Tlaxcala',
      });

      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({
          latitud: null,
          longitud: null,
          direccion: 'Calle 5, Tlaxcala',
        }),
      );
    });

    const constanciasInvalidas: [string, () => string][] = [
      [
        'alterada',
        () => {
          const [cuerpo, firma] = constanciaPara().split('.');
          return `${cuerpo.slice(0, -2)}xx.${firma}`;
        },
      ],
      ['vencida', () => constanciaPara(FOTO, ASEGURADO, Date.now() - 1)],
      ['de otro asegurado', () => constanciaPara(FOTO, 'otro-asegurado')],
      [
        'de otra foto',
        () =>
          constanciaPara({
            ...FOTO,
            buffer: Buffer.from('otra foto distinta'),
          }),
      ],
    ];

    it.each(constanciasInvalidas)(
      'constancia %s → 400 sin subir ni insertar nada',
      async (_caso, constancia) => {
        const { servicio, storageFrom, insert } = crearServicio();

        await expect(
          servicio.crear(ASEGURADO, FOTO, constancia(), DATOS),
        ).rejects.toThrow(new BadRequestException(CONSTANCIA_INVALIDA));
        expect(storageFrom).not.toHaveBeenCalled();
        expect(insert).not.toHaveBeenCalled();
      },
    );

    it('sin coordenadas ni dirección → 400 sin subir nada', async () => {
      const { servicio, storageFrom } = crearServicio();
      const { latitud: _lat, longitud: _lon, ...sinUbicacion } = DATOS;

      await expect(
        servicio.crear(ASEGURADO, FOTO, constanciaPara(), sinUbicacion),
      ).rejects.toThrow(BadRequestException);
      expect(storageFrom).not.toHaveBeenCalled();
    });

    it('si el insert falla, borra la foto recién subida', async () => {
      const supabaseFalso = crearSupabaseFalso({
        data: null,
        error: { code: '23514', message: 'check violation' },
      });
      const { servicio, fotos } = crearServicio(supabaseFalso);

      await expect(
        servicio.crear(ASEGURADO, FOTO, constanciaPara(), DATOS),
      ).rejects.toThrow(InternalServerErrorException);
      const [ruta] = fotos.upload.mock.calls[0] as any[];
      expect(fotos.remove).toHaveBeenCalledWith([ruta]);
    });

    it('si la subida falla, no inserta nada', async () => {
      const supabaseFalso = crearSupabaseFalso();
      supabaseFalso.fotos.upload.mockResolvedValue({
        data: null,
        error: { message: 'storage caído' },
      } as any);
      const { servicio, insert } = crearServicio(supabaseFalso);

      await expect(
        servicio.crear(ASEGURADO, FOTO, constanciaPara(), DATOS),
      ).rejects.toThrow(InternalServerErrorException);
      expect(insert).not.toHaveBeenCalled();
    });

    it('usa el bucket accidentes-fotos', async () => {
      const { servicio, storageFrom } = crearServicio();

      await servicio.crear(ASEGURADO, FOTO, constanciaPara(), DATOS);

      expect(storageFrom).toHaveBeenCalledWith(BUCKET_FOTOS);
    });
  });

  describe('conversar', () => {
    const MENSAJES = [{ rol: 'usuario' as const, texto: 'Sí, estoy bien' }];

    it('una confirmación con datos incompletos se degrada a entrevista', async () => {
      const { servicio, conversar } = crearServicio();
      const { vehiculoPlacas: _placas, ...sinPlacas } = DATOS_COMPLETOS;
      conversar.mockResolvedValue({
        mensaje: 'Confirma tus datos',
        etapa: 'confirmacion',
        sugerir911: false,
        datos: sinPlacas,
      });

      const resultado = await servicio.conversar({ mensajes: MENSAJES });

      expect(resultado.etapa).toBe('entrevista');
    });

    it('una confirmación con terceros sin descripción se degrada a entrevista', async () => {
      const { servicio, conversar } = crearServicio();
      conversar.mockResolvedValue({
        mensaje: 'Confirma tus datos',
        etapa: 'confirmacion',
        sugerir911: false,
        datos: { ...DATOS_COMPLETOS, hayTerceros: true },
      });

      const resultado = await servicio.conversar({ mensajes: MENSAJES });

      expect(resultado.etapa).toBe('entrevista');
    });

    it('acepta la confirmación cuando están todos los datos', async () => {
      const { servicio, conversar } = crearServicio();
      conversar.mockResolvedValue({
        mensaje: 'Confirma tus datos',
        etapa: 'confirmacion',
        sugerir911: false,
        datos: DATOS_COMPLETOS,
      });

      const resultado = await servicio.conversar({ mensajes: MENSAJES });

      expect(resultado).toEqual({
        mensaje: 'Confirma tus datos',
        etapa: 'confirmacion',
        sugerir911: false,
        datos: DATOS_COMPLETOS,
      });
    });

    it('descarta campos desconocidos, de tipo incorrecto y fechas inválidas', async () => {
      const { servicio, conversar } = crearServicio();
      conversar.mockResolvedValue({
        mensaje: 'Hola',
        etapa: 'entrevista',
        sugerir911: true,
        datos: {
          aseguradoBien: 'no',
          fechaHoraAccidente: 'ayer',
          vehiculoMarca: ' Nissan ',
          vehiculoPlacas: '',
          gravedad: 'grave',
        },
      });

      const resultado = await servicio.conversar({ mensajes: MENSAJES });

      expect(resultado).toEqual({
        mensaje: 'Hola',
        etapa: 'entrevista',
        sugerir911: true,
        datos: { vehiculoMarca: 'Nissan' },
      });
    });

    it('una respuesta sin mensaje responde 502', async () => {
      const { servicio, conversar } = crearServicio();
      conversar.mockResolvedValue({ etapa: 'entrevista', datos: {} });

      await expect(servicio.conversar({ mensajes: MENSAJES })).rejects.toThrow(
        BadGatewayException,
      );
    });
  });
});
