// Asegurado tal como lo expone la API (camelCase)
export interface Asegurado {
  id: string;
  nombre: string;
  edad: number;
  idContrato: string;
  fechaVencimiento: string;
  fechaRegistro: string;
  correo: string;
}

// Fila de public.asegurados (snake_case)
export interface FilaAsegurado {
  id: string;
  nombre: string;
  edad: number;
  id_contrato: string;
  fecha_vencimiento: string;
  fecha_registro: string;
  correo: string;
}

export function aAsegurado(fila: FilaAsegurado): Asegurado {
  return {
    id: fila.id,
    nombre: fila.nombre,
    edad: fila.edad,
    idContrato: fila.id_contrato,
    fechaVencimiento: fila.fecha_vencimiento,
    fechaRegistro: fila.fecha_registro,
    correo: fila.correo,
  };
}
