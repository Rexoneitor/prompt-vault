/** Utilidades de texto puras (sin DOM ni Node). */

const DIACRITICS = /\p{M}/gu

/** Minúsculas y sin acentos: base de búsqueda y de unicidad de nombres. */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(DIACRITICS, '').toLowerCase()
}

/** Clave de comparación para nombres (categorías, etiquetas…): sin acentos, mayúsculas ni espacios sobrantes. */
export function nameKey(name: string): string {
  return normalize(name).replace(/\s+/g, ' ').trim()
}

/**
 * Normaliza conservando el mapa índice-normalizado → índice-original,
 * necesario para resaltar coincidencias sobre el texto original.
 */
export function normalizeWithMap(text: string): { normalized: string; map: number[] } {
  let normalized = ''
  const map: number[] = []
  let index = 0
  for (const char of text) {
    const piece = normalize(char)
    for (let i = 0; i < piece.length; i++) map.push(index)
    normalized += piece
    index += char.length
  }
  return { normalized, map }
}

export function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function truncate(text: string, max: number): string {
  const flat = collapseSpaces(text)
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`
}

/** Título razonable a partir del contenido: primera línea no vacía, sin marcas de markdown. */
export function deriveTitle(content: string): string {
  const firstLine = content.split(/\r?\n/).find((line) => line.trim().length > 0) ?? ''
  const clean = firstLine.replace(/^[\s#>*\-`]+/, '').replace(/\{\{|\}\}/g, '')
  return truncate(clean, 70) || 'Prompt sin título'
}

export function countWords(text: string): number {
  const matches = text.match(/\S+/g)
  return matches ? matches.length : 0
}

/** Estimación rápida y orientativa (≈ 4 caracteres por token). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}
