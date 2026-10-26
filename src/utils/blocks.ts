export type ContentBlock = { kind: 'text'; text: string } | { kind: 'code'; text: string; lang: string }

const OPEN = /^\s{0,3}(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/

/** Separa el texto de un prompt en párrafos y bloques de código delimitados con ``` o ~~~. */
export function splitCodeBlocks(content: string): ContentBlock[] {
  const lines = content.split('\n')
  const blocks: ContentBlock[] = []
  let text: string[] = []

  const flushText = () => {
    if (text.length > 0) blocks.push({ kind: 'text', text: text.join('\n') })
    text = []
  }

  for (let i = 0; i < lines.length; i++) {
    const open = OPEN.exec(lines[i])
    if (!open) {
      text.push(lines[i])
      continue
    }
    const fence = open[1]
    let end = i + 1
    while (end < lines.length) {
      const trimmed = lines[end].trim()
      if (trimmed.length >= fence.length && trimmed === fence[0].repeat(trimmed.length)) break
      end++
    }
    if (end >= lines.length) {
      // Bloque sin cerrar: se muestra como texto normal en lugar de tragarse el resto.
      text.push(lines[i])
      continue
    }
    flushText()
    blocks.push({ kind: 'code', text: lines.slice(i + 1, end).join('\n'), lang: open[2] })
    i = end
  }
  flushText()
  return blocks
}
