// Minúsculas y sin acentos, para que "perez" encuentre a "Pérez"
export function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}
