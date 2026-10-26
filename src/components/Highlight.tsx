import { Fragment } from 'react'
import { findMatchRanges } from '@shared/search'

/** Resalta las coincidencias de la búsqueda dentro de un texto. */
export function Highlight({ text, tokens }: { text: string; tokens: readonly string[] }) {
  const ranges = findMatchRanges(text, tokens)
  if (ranges.length === 0) return <>{text}</>
  const parts: React.ReactNode[] = []
  let cursor = 0
  ranges.forEach((range, index) => {
    if (range.start > cursor) parts.push(<Fragment key={`t${index}`}>{text.slice(cursor, range.start)}</Fragment>)
    parts.push(<mark key={`m${index}`}>{text.slice(range.start, range.end)}</mark>)
    cursor = range.end
  })
  if (cursor < text.length) parts.push(<Fragment key="end">{text.slice(cursor)}</Fragment>)
  return <>{parts}</>
}
