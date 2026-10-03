// 'YYYY-MM-DD' -> 'DD/MM/YYYY' sin pasar por Date (evita el desfase de zona horaria)
export function formatearFecha(fecha: string) {
  const [anio, mes, dia] = fecha.split('-')
  return `${dia}/${mes}/${anio}`
}
