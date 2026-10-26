import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Popover } from './Popover'

export interface MenuItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
  /** Muestra una línea separadora antes de este elemento. */
  separatorBefore?: boolean
  hint?: string
}

interface DropdownMenuProps {
  /** Recibe las props que debe esparcir el elemento disparador. */
  trigger: (props: {
    ref: React.RefObject<HTMLButtonElement | null>
    onClick: () => void
    'aria-haspopup': 'menu'
    'aria-expanded': boolean
  }) => ReactNode
  items: MenuItem[]
  align?: 'start' | 'end'
  label: string
}

export function DropdownMenu({ trigger, items, align = 'end', label }: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)

  const focusItem = (delta: number | 'first' | 'last') => {
    const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
    if (buttons.length === 0) return
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = delta === 'first' ? 0 : delta === 'last' ? buttons.length - 1 : (current + delta + buttons.length) % buttons.length
    buttons[next].focus()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') focusItem(1)
    else if (event.key === 'ArrowUp') focusItem(-1)
    else if (event.key === 'Home') focusItem('first')
    else if (event.key === 'End') focusItem('last')
    else return
    event.preventDefault()
  }

  return (
    <>
      {trigger({
        ref: anchor,
        onClick: () => setOpen((value) => !value),
        'aria-haspopup': 'menu',
        'aria-expanded': open,
      })}
      <Popover open={open} onOpenChange={setOpen} anchor={anchor} align={align} className="menu" label={label}>
        <div
          ref={(node) => {
            list.current = node
            if (node && !node.contains(document.activeElement)) queueMicrotask(() => focusItem('first'))
          }}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
        >
          {items.map((item) => (
            <div key={item.label}>
              {item.separatorBefore && <div className="menu-separator" role="separator" />}
              <button
                type="button"
                role="menuitem"
                className={`menu-item${item.danger ? ' is-danger' : ''}`}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
              >
                {item.icon}
                <span className="menu-item-label">{item.label}</span>
                {item.hint && <span className="menu-item-hint">{item.hint}</span>}
              </button>
            </div>
          ))}
        </div>
      </Popover>
    </>
  )
}
