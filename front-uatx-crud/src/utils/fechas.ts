// 'YYYY-MM-DD' -> 'DD/MM/YYYY' sin pasar por Date (evita el desfase de zona horaria)
export function formatearFecha(fecha: string) {
  const [anio, mes, dia] = fecha.split('-')
  return `${dia}/${mes}/${anio}`
}

// ISO 8601 con hora -> 'DD/MM/YYYY HH:mm' en la hora local del navegador
export function formatearFechaHora(fechaIso: string) {
  const fecha = new Date(fechaIso)
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)}/${fecha.getFullYear()} ${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`
}
