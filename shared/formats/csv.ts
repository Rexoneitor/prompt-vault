/** CSV (RFC 4180) mínimo: comillas, saltos de línea dentro de campos, BOM y delimitador `,` `;` o tabulador. */

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  let best = ','
  let bestCount = 0
  for (const candidate of [',', ';', '\t']) {
    let count = 0
    let quoted = false
    for (const char of firstLine) {
      if (char === '"') quoted = !quoted
      else if (!quoted && char === candidate) count++
    }
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }
  return best
}

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '')
  const delimiter = detectDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  const endField = () => {
    row.push(field)
    field = ''
  }
  const endRow = () => {
    endField()
    if (row.some((value) => value.trim().length > 0)) rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += char
    } else if (char === '"' && field.length === 0) {
      quoted = true
    } else if (char === delimiter) {
      endField()
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      endRow()
    } else field += char
  }
  if (field.length > 0 || row.length > 0) endRow()
  return rows
}

function escapeField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Serializa filas a CSV con BOM (Excel abre así los acentos correctamente). */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return `﻿${rows.map((row) => row.map(escapeField).join(',')).join('\r\n')}\r\n`
}
