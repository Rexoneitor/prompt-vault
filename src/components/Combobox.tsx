import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { nameKey } from '@shared/text'
import { ColorDot } from './ColorDot'
import { Popover } from './Popover'

export interface ComboOption {
  id: string
  label: string
  color?: string
}

interface ComboboxProps {
  label: string
  value: string | null
  options: ComboOption[]
  onChange: (id: string | null) => void
  placeholder: string
  /** Texto de la opción que deja el campo vacío; si se omite, el campo no admite «ninguno». */
  clearLabel?: string
  /** Si se indica, permite crear una opción nueva con el texto buscado. Devuelve el id creado. */
  onCreate?: (name: string) => Promise<string | undefined>
  createLabel?: (name: string) => string
  searchPlaceholder?: string
}

type Row = { kind: 'clear' } | { kind: 'option'; option: ComboOption } | { kind: 'create'; name: string }

/** Selector con búsqueda y, opcionalmente, creación al vuelo. */
export function Combobox({
  label,
  value,
  options,
  onChange,
  placeholder,
  clearLabel,
  onCreate,
  createLabel,
  searchPlaceholder = 'Buscar…',
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const anchor = useRef<HTMLButtonElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const listId = useId()
  const selected = options.find((option) => option.id === value)

  const rows = useMemo<Row[]>(() => {
    const key = nameKey(query)
    const filtered = key ? options.filter((option) => nameKey(option.label).includes(key)) : options
    const result: Row[] = []
    if (clearLabel && !key) result.push({ kind: 'clear' })
    for (const option of filtered) result.push({ kind: 'option', option })
    const exists = options.some((option) => nameKey(option.label) === key)
    if (onCreate && key && !exists) result.push({ kind: 'create', name: query.trim() })
    return result
  }, [options, query, clearLabel, onCreate])

  // El popover solo es visible tras montarse, así que el foco se da después (autoFocus actuaría demasiado pronto).
  useEffect(() => {
    if (open) searchInput.current?.focus()
  }, [open])

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  const choose = async (row: Row | undefined) => {
    if (!row) return
    if (row.kind === 'clear') onChange(null)
    else if (row.kind === 'option') onChange(row.option.id)
    else if (onCreate) {
      const id = await onCreate(row.name)
      if (id) onChange(id)
    }
    close()
    anchor.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') setActive((index) => Math.min(index + 1, rows.length - 1))
    else if (event.key === 'ArrowUp') setActive((index) => Math.max(index - 1, 0))
    else if (event.key === 'Enter') void choose(rows[active])
    else return
    event.preventDefault()
  }

  return (
    <>
      <button
        ref={anchor}
        type="button"
        className="combo-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current)
          setActive(0)
        }}
      >
        {selected ? (
          <span className="combo-value">
            {selected.color && <ColorDot color={selected.color} />}
            <span className="truncate">{selected.label}</span>
          </span>
        ) : (
          <span className="combo-placeholder">{placeholder}</span>
        )}
        <ChevronDown size={15} aria-hidden />
      </button>

      <Popover
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        anchor={anchor}
        matchAnchorWidth
        className="combo-popover"
        label={label}
      >
        <div className="combo-search">
          <input
            ref={searchInput}
            value={query}
            placeholder={searchPlaceholder}
            aria-label={`Buscar ${label.toLowerCase()}`}
            aria-controls={listId}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
          />
        </div>
        <div className="combo-list" role="listbox" id={listId} aria-label={label}>
          {rows.length === 0 && <p className="combo-empty">Sin resultados</p>}
          {rows.map((row, index) => {
            const isActive = index === active
            if (row.kind === 'create') {
              return (
                <button
                  key="create"
                  type="button"
                  role="option"
                  aria-selected={false}
                  className={`combo-row combo-create${isActive ? ' is-active' : ''}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => void choose(row)}
                >
                  <Plus size={15} aria-hidden />
                  <span className="truncate">{createLabel ? createLabel(row.name) : `Crear «${row.name}»`}</span>
                </button>
              )
            }
            const isSelected = row.kind === 'clear' ? value === null : row.option.id === value
            return (
              <button
                key={row.kind === 'clear' ? 'clear' : row.option.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`combo-row${isActive ? ' is-active' : ''}`}
                onMouseEnter={() => setActive(index)}
                onClick={() => void choose(row)}
              >
                {row.kind === 'option' && row.option.color && <ColorDot color={row.option.color} />}
                <span className={`truncate${row.kind === 'clear' ? ' faint' : ''}`}>
                  {row.kind === 'clear' ? clearLabel : row.option.label}
                </span>
                {isSelected && <Check size={15} className="combo-check" aria-hidden />}
              </button>
            )
          })}
        </div>
      </Popover>
    </>
  )
}
