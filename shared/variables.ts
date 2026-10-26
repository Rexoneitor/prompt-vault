/**
 * Variables de plantilla con la sintaxis `{{nombre}}`.
 * Solo se reconoce esa forma: los `[CORCHETES]` son habituales en texto normal y darían falsos positivos.
 */

const VARIABLE_NAME = '[\\p{L}\\p{N}_.-]+'

function variablePattern(): RegExp {
  return new RegExp(`\\{\\{\\s*(${VARIABLE_NAME})\\s*\\}\\}`, 'gu')
}

export type VariableValues = Record<string, string>

/** Nombres únicos, en orden de aparición. */
export function extractVariables(content: string): string[] {
  const seen = new Set<string>()
  for (const match of content.matchAll(variablePattern())) seen.add(match[1])
  return [...seen]
}

/** Sustituye las variables con valor; las vacías o sin valor se dejan intactas. */
export function fillVariables(content: string, values: VariableValues): string {
  return content.replace(variablePattern(), (whole, name: string) => {
    const value = values[name]
    return value !== undefined && value.length > 0 ? value : whole
  })
}

export function hasFilledValues(values: VariableValues): boolean {
  return Object.values(values).some((value) => value.length > 0)
}

export type VariableSegment = { kind: 'text'; text: string } | { kind: 'variable'; name: string; raw: string }

/** Divide un texto en trozos de texto y variables, para pintar las variables como chips. */
export function splitVariables(content: string): VariableSegment[] {
  const segments: VariableSegment[] = []
  let cursor = 0
  for (const match of content.matchAll(variablePattern())) {
    const start = match.index ?? 0
    if (start > cursor) segments.push({ kind: 'text', text: content.slice(cursor, start) })
    segments.push({ kind: 'variable', name: match[1], raw: match[0] })
    cursor = start + match[0].length
  }
  if (cursor < content.length) segments.push({ kind: 'text', text: content.slice(cursor) })
  return segments
}
