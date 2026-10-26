/**
 * Transformaciones puras sobre el texto de un textarea, expresadas como «parches»:
 * reemplazar el rango [from, to) por `insert` y dejar seleccionado [selectStart, selectEnd).
 * Así el editor puede aplicarlas con `execCommand('insertText')` y conservar el Ctrl+Z nativo.
 */
export interface TextPatch {
  from: number
  to: number
  insert: string
  selectStart: number
  selectEnd: number
}

export interface Selection {
  value: string
  start: number
  end: number
}

export function applyPatch(value: string, patch: TextPatch): string {
  return value.slice(0, patch.from) + patch.insert + value.slice(patch.to)
}

/** Inserta `{{variable}}` con el nombre seleccionado para sobrescribirlo. Si ya había texto seleccionado, lo convierte en variable. */
export function insertVariable({ value, start, end }: Selection): TextPatch {
  const selected = value.slice(start, end).trim()
  const name = selected.replace(/[^\p{L}\p{N}_.-]+/gu, '_').replace(/^_+|_+$/g, '') || 'variable'
  return { from: start, to: end, insert: `{{${name}}}`, selectStart: start + 2, selectEnd: start + 2 + name.length }
}

/** Envuelve la selección (o una línea vacía) en un bloque de código. */
export function insertCodeBlock({ value, start, end }: Selection): TextPatch {
  const selected = value.slice(start, end)
  const lead = start > 0 && value[start - 1] !== '\n' ? '\n' : ''
  const tail = end < value.length && value[end] !== '\n' ? '\n' : ''
  const caret = start + lead.length + 4
  return {
    from: start,
    to: end,
    insert: `${lead}\`\`\`\n${selected}\n\`\`\`${tail}`,
    selectStart: caret,
    selectEnd: caret + selected.length,
  }
}

/** Convierte las líneas seleccionadas en lista con viñetas (o las quita si ya lo eran todas). */
export function toggleBulletList({ value, start, end }: Selection): TextPatch {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const nextBreak = value.indexOf('\n', end)
  const lineEnd = nextBreak === -1 ? value.length : nextBreak
  const lines = value.slice(lineStart, lineEnd).split('\n')
  const allBulleted = lines.every((line) => /^\s*[-*]\s/.test(line))
  const insert = lines.map((line) => (allBulleted ? line.replace(/^(\s*)[-*]\s/, '$1') : `- ${line}`)).join('\n')
  return { from: lineStart, to: lineEnd, insert, selectStart: lineStart, selectEnd: lineStart + insert.length }
}
