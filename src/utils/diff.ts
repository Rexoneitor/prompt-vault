export type DiffLine = { type: 'same' | 'add' | 'del'; text: string }

/** Diff por líneas (LCS). Suficiente para comparar versiones de un prompt. */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n')
  const b = after.split('\n')
  const rows = a.length + 1
  const cols = b.length + 1
  // Tabla de longitudes de la subsecuencia común más larga, rellenada desde el final.
  const table = Array.from({ length: rows }, () => new Uint32Array(cols))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }

  const result: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      result.push({ type: 'same', text: a[i] })
      i++
      j++
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      result.push({ type: 'del', text: a[i++] })
    } else {
      result.push({ type: 'add', text: b[j++] })
    }
  }
  while (i < a.length) result.push({ type: 'del', text: a[i++] })
  while (j < b.length) result.push({ type: 'add', text: b[j++] })
  return result
}
