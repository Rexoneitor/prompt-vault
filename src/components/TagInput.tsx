import { useId, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { nameKey } from '@shared/text'
import { Popover } from './Popover'

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  /** Etiquetas existentes en la biblioteca, para autocompletar. */
  suggestions: string[]
}

const MAX_SUGGESTIONS = 7

/** Campo de etiquetas: Enter, coma o Tab confirman; Retroceso borra la última; sugiere las ya existentes. */
export function TagInput({ value, onChange, suggestions }: TagInputProps) {
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(-1)
  const wrapper = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()

  const taken = useMemo(() => new Set(value.map(nameKey)), [value])

  const matches = useMemo(() => {
    const key = nameKey(draft.replace(/^#+/, ''))
    return suggestions.filter((tag) => !taken.has(nameKey(tag)) && (key === '' || nameKey(tag).includes(key))).slice(0, MAX_SUGGESTIONS)
  }, [suggestions, taken, draft])

  const add = (raw: string) => {
    const additions: string[] = []
    for (const part of raw.split(',')) {
      const tag = part.replace(/^#+/, '').replace(/\s+/g, ' ').trim()
      if (tag && !taken.has(nameKey(tag)) && !additions.some((added) => nameKey(added) === nameKey(tag))) additions.push(tag)
    }
    if (additions.length > 0) onChange([...value, ...additions])
    setDraft('')
    setActive(-1)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',' || (event.key === 'Tab' && draft.trim())) {
      if (event.key === 'Enter' && active >= 0 && matches[active]) add(matches[active])
      else if (draft.trim()) add(draft)
      else if (event.key !== 'Tab') return
      event.preventDefault()
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    } else if (event.key === 'ArrowDown' && matches.length > 0) {
      setActive((index) => (index + 1) % matches.length)
      event.preventDefault()
    } else if (event.key === 'ArrowUp' && matches.length > 0) {
      setActive((index) => (index <= 0 ? matches.length - 1 : index - 1))
      event.preventDefault()
    } else if (event.key === 'Escape') {
      setFocused(false)
    }
  }

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text')
    if (!text.includes(',') && !text.includes('\n')) return
    event.preventDefault()
    add(text.replace(/\n/g, ','))
  }

  const showList = focused && matches.length > 0

  return (
    <div className="tag-input" ref={wrapper} onClick={() => input.current?.focus()}>
      {value.map((tag) => (
        <span key={tag} className="chip chip-removable">
          {tag}
          <button type="button" aria-label={`Quitar etiqueta ${tag}`} onClick={() => onChange(value.filter((item) => item !== tag))}>
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        ref={input}
        value={draft}
        placeholder={value.length === 0 ? 'Añadir etiquetas…' : ''}
        aria-label="Etiquetas"
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(event) => {
          setDraft(event.target.value)
          setActive(-1)
        }}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          if (draft.trim()) add(draft)
        }}
      />
      <Popover
        open={showList}
        onOpenChange={(next) => !next && setFocused(false)}
        anchor={wrapper}
        matchAnchorWidth
        className="combo-popover"
        label="Etiquetas sugeridas"
      >
        <div className="combo-list" role="listbox" id={listId}>
          {matches.map((tag, index) => (
            <button
              key={tag}
              type="button"
              role="option"
              aria-selected={index === active}
              className={`combo-row${index === active ? ' is-active' : ''}`}
              // mousedown evita que el campo pierda el foco antes de registrar el clic.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                add(tag)
                input.current?.focus()
              }}
            >
              <span className="truncate">{tag}</span>
            </button>
          ))}
        </div>
      </Popover>
    </div>
  )
}
