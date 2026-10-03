import {
  firmarConstancia,
  huellaSha256,
  verificarConstancia,
  type ContenidoConstancia,
} from './constancia.js';

const SECRETO = 'secreto-de-prueba';
const AHORA = 1_790_000_000_000;
const FOTO = Buffer.from('bytes de la foto del choque');

const CONTENIDO: ContenidoConstancia = {
  aseguradoId: 'uuid-asegurado',
  fotoSha256: huellaSha256(FOTO),
  descripcion: 'Choque por alcance con daño en la defensa trasera',
  gravedad: 'moderado',
  expira: AHORA + 60 * 60 * 1000,
};

const ESPERADO = {
  aseguradoId: 'uuid-asegurado',
  fotoSha256: huellaSha256(FOTO),
};

// Cambia el primer carácter de un segmento base64url por otro válido
// (el último puede llevar bits de relleno y decodificar a los mismos bytes)
function alterar(segmento: string): string {
  const primero = segmento[0] === 'A' ? 'B' : 'A';
  return primero + segmento.slice(1);
}

describe('constancia', () => {
  it('acepta una constancia válida y devuelve su contenido', () => {
    const constancia = firmarConstancia(CONTENIDO, SECRETO);

    expect(verificarConstancia(constancia, ESPERADO, SECRETO, AHORA)).toEqual(
      CONTENIDO,
    );
  });

  it('rechaza una constancia con el contenido alterado', () => {
    const [, firma] = firmarConstancia(CONTENIDO, SECRETO).split('.');
    const cuerpoAlterado = Buffer.from(
      JSON.stringify({ ...CONTENIDO, gravedad: 'leve' }),
    ).toString('base64url');

    expect(
      verificarConstancia(
        `${cuerpoAlterado}.${firma}`,
        ESPERADO,
        SECRETO,
        AHORA,
      ),
    ).toBeNull();
  });

  it('rechaza una constancia con la firma alterada', () => {
    const [cuerpo, firma] = firmarConstancia(CONTENIDO, SECRETO).split('.');

    expect(
      verificarConstancia(
        `${cuerpo}.${alterar(firma)}`,
        ESPERADO,
        SECRETO,
        AHORA,
      ),
    ).toBeNull();
  });

  it('rechaza una constancia firmada con otro secreto', () => {
    const constancia = firmarConstancia(CONTENIDO, 'otro-secreto');

    expect(
      verificarConstancia(constancia, ESPERADO, SECRETO, AHORA),
    ).toBeNull();
  });

  it('rechaza una constancia vencida', () => {
    const constancia = firmarConstancia(CONTENIDO, SECRETO);

    expect(
      verificarConstancia(constancia, ESPERADO, SECRETO, CONTENIDO.expira),
    ).toBeNull();
  });

  it('rechaza una constancia de otro asegurado', () => {
    const constancia = firmarConstancia(CONTENIDO, SECRETO);

    expect(
      verificarConstancia(
        constancia,
        { ...ESPERADO, aseguradoId: 'uuid-otro' },
        SECRETO,
        AHORA,
      ),
    ).toBeNull();
  });

  it('rechaza una constancia enviada con una foto distinta', () => {
    const constancia = firmarConstancia(CONTENIDO, SECRETO);
    const otraFoto = huellaSha256(Buffer.from('otra foto'));

    expect(
      verificarConstancia(
        constancia,
        { ...ESPERADO, fotoSha256: otraFoto },
        SECRETO,
        AHORA,
      ),
    ).toBeNull();
  });

  it('rechaza un texto que no tiene el formato de una constancia', () => {
    expect(
      verificarConstancia('no-es-constancia', ESPERADO, SECRETO, AHORA),
    ).toBeNull();
  });
});
