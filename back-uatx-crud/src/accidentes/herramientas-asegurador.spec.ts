import type { AccidenteAsegurador } from './accidentes.types.js';
import {
  buscarAccidentes,
  contarAccidentes,
  detalleAccidente,
} from './herramientas-asegurador.js';

const MEXICO = 'America/Mexico_City';

function accidente(
  id: string,
  cambios: Partial<AccidenteAsegurador> = {},
): AccidenteAsegurador {
  return {
    id,
    estado: 'pendiente',
    fechaHoraAccidente: '2026-10-01T18:00:00+00:00',
    fechaReporte: '2026-10-01T19:00:00+00:00',
    resumen: 'Choque por alcance',
    aseguradoBien: true,
    latitud: 19.31,
    longitud: -98.24,
    direccion: null,
    vehiculoMarca: 'Nissan',
    vehiculoModelo: 'Versa',
    vehiculoPlacas: 'TLX-123-A',
    hayTerceros: false,
    tercerosDescripcion: null,
    fotoDescripcion: 'Dos autos con daños en la defensa',
    gravedad: 'leve',
    notaAsegurador: null,
    fechaActualizacion: null,
    actualizadoPor: null,
    asegurado: {
      id: 'asegurado-1',
      nombre: 'Ana López',
      idContrato: 'CTR-01',
      correo: 'ana@correo.com',
      fechaVencimiento: '2030-12-31',
    },
    ...cambios,
  };
}

const JOSE = {
  id: 'asegurado-2',
  nombre: 'José Martínez',
  idContrato: 'CTR-02',
  correo: 'jose@correo.com',
  fechaVencimiento: '2031-01-31',
};

const ACCIDENTES = [
  accidente('a1'),
  accidente('a2', { estado: 'aprobado', gravedad: 'grave' }),
  accidente('a3', {
    estado: 'pendiente',
    gravedad: 'grave',
    vehiculoPlacas: 'PUE 987 B',
    fechaReporte: '2026-10-03T12:00:00+00:00',
    asegurado: JOSE,
  }),
  accidente('a4', { estado: 'rechazado', asegurado: JOSE }),
  // 21:30 del 3 de octubre en Ciudad de México, 4 de octubre en UTC
  accidente('a5', {
    estado: 'en_revision',
    fechaHoraAccidente: '2026-10-04T03:30:00+00:00',
    fechaReporte: '2026-10-04T04:00:00+00:00',
  }),
];

describe('herramientas del asegurador', () => {
  describe('contarAccidentes', () => {
    it('cuenta el total y por estado, con ceros en los estados sin accidentes', () => {
      expect(contarAccidentes(ACCIDENTES, {}, MEXICO)).toEqual({
        total: 5,
        porEstado: {
          pendiente: 2,
          en_revision: 1,
          aprobado: 1,
          rechazado: 1,
        },
      });
      expect(contarAccidentes([], undefined, MEXICO)).toEqual({
        total: 0,
        porEstado: { pendiente: 0, en_revision: 0, aprobado: 0, rechazado: 0 },
      });
    });

    it('filtra por gravedad', () => {
      expect(
        contarAccidentes(ACCIDENTES, { gravedad: 'grave' }, MEXICO),
      ).toMatchObject({
        total: 2,
        porEstado: { pendiente: 1, aprobado: 1 },
      });
    });

    it('filtra por fechas en la zona horaria del asegurador', () => {
      const dia = { desde: '2026-10-03', hasta: '2026-10-03' };

      expect(contarAccidentes(ACCIDENTES, dia, MEXICO)).toMatchObject({
        total: 1,
        porEstado: { en_revision: 1 },
      });
      expect(contarAccidentes(ACCIDENTES, dia, 'UTC')).toMatchObject({
        total: 0,
      });
    });

    it('devuelve un error con una gravedad o una fecha inválida', () => {
      expect(
        contarAccidentes(ACCIDENTES, { gravedad: 'catastrofico' }, MEXICO),
      ).toHaveProperty('error');
      expect(
        contarAccidentes(ACCIDENTES, { desde: '03/10/2026' }, MEXICO),
      ).toHaveProperty('error');
      expect(
        contarAccidentes(ACCIDENTES, { hasta: '2026-02-30' }, MEXICO),
      ).toHaveProperty('error');
      expect(
        contarAccidentes(ACCIDENTES, { hasta: '2026-13-01' }, MEXICO),
      ).toHaveProperty('error');
    });
  });

  describe('buscarAccidentes', () => {
    it('busca por nombre sin distinguir mayúsculas ni acentos', () => {
      const resultado = buscarAccidentes(
        ACCIDENTES,
        { texto: 'jose MARTINEZ' },
        MEXICO,
      );

      expect(resultado).toMatchObject({ total: 2 });
      expect(
        'accidentes' in resultado && resultado.accidentes.map((a) => a.id),
      ).toEqual(['a3', 'a4']);
    });

    it('busca por idContrato y por placas sin guiones ni espacios', () => {
      expect(
        buscarAccidentes(ACCIDENTES, { texto: 'ctr-02' }, MEXICO),
      ).toMatchObject({ total: 2 });
      expect(
        buscarAccidentes(ACCIDENTES, { texto: 'pue987b' }, MEXICO),
      ).toMatchObject({ total: 1, accidentes: [{ id: 'a3' }] });
    });

    it('combina estado y gravedad y devuelve el asegurado de cada accidente', () => {
      expect(
        buscarAccidentes(
          ACCIDENTES,
          { estado: 'pendiente', gravedad: 'grave' },
          MEXICO,
        ),
      ).toEqual({
        total: 1,
        accidentes: [
          {
            id: 'a3',
            estado: 'pendiente',
            gravedad: 'grave',
            fechaHoraAccidente: '2026-10-01T18:00:00+00:00',
            fechaReporte: '2026-10-03T12:00:00+00:00',
            vehiculoMarca: 'Nissan',
            vehiculoModelo: 'Versa',
            vehiculoPlacas: 'PUE 987 B',
            asegurado: { nombre: 'José Martínez', idContrato: 'CTR-02' },
          },
        ],
      });
    });

    it('ordena del reporte más reciente al más antiguo y respeta el límite sin cambiar el total', () => {
      const resultado = buscarAccidentes(ACCIDENTES, { limite: 2 }, MEXICO);

      expect(resultado).toMatchObject({
        total: 5,
        accidentes: [{ id: 'a5' }, { id: 'a3' }],
      });
    });

    it('devuelve 10 accidentes como máximo por defecto', () => {
      const muchos = Array.from({ length: 15 }, (_, i) => accidente(`m${i}`));

      const resultado = buscarAccidentes(muchos, {}, MEXICO);

      expect(resultado).toMatchObject({ total: 15 });
      expect('accidentes' in resultado && resultado.accidentes).toHaveLength(
        10,
      );
    });

    it('devuelve un error con un estado o un límite inválido', () => {
      expect(
        buscarAccidentes(ACCIDENTES, { estado: 'cerrado' }, MEXICO),
      ).toHaveProperty('error');
      expect(
        buscarAccidentes(ACCIDENTES, { limite: 0 }, MEXICO),
      ).toHaveProperty('error');
      expect(
        buscarAccidentes(ACCIDENTES, { limite: 21 }, MEXICO),
      ).toHaveProperty('error');
      expect(
        buscarAccidentes(ACCIDENTES, { limite: 2.5 }, MEXICO),
      ).toHaveProperty('error');
    });
  });

  describe('detalleAccidente', () => {
    it('devuelve el accidente completo con su asegurado', () => {
      expect(detalleAccidente(ACCIDENTES, { id: 'a3' })).toBe(ACCIDENTES[2]);
    });

    it('devuelve un error si el id no existe', () => {
      expect(detalleAccidente(ACCIDENTES, { id: 'no-existe' })).toEqual({
        error: 'No existe un accidente con ese id',
      });
      expect(detalleAccidente(ACCIDENTES, undefined)).toHaveProperty('error');
    });
  });
});
