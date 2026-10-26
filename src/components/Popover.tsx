import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'

interface PopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Elemento al que se ancla (pulsarlo no cuenta como «pulsar fuera»). */
  anchor: RefObject<HTMLElement | null>
  children: ReactNode
  align?: 'start' | 'end'
  className?: string
  /** Ancho mínimo igual al del ancla. */
  matchAnchorWidth?: boolean
  label?: string
}

const GAP = 6
const MARGIN = 8

/**
 * Capa flotante en la «top layer» del navegador (Popover API en modo manual): nunca la recortan
 * contenedores con scroll. Se cierra con Esc, al pulsar fuera, al redimensionar, y se recoloca
 * encima del ancla si no cabe debajo.
 */
export function Popover({ open, onOpenChange, anchor, children, align = 'start', className, matchAnchorWidth, label }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const isOpen = element.matches(':popover-open')
    if (open && !isOpen) element.showPopover()
    if (!open && isOpen) element.hidePopover()
  }, [open])

  // Colocación: se recalcula en cada render mientras está abierto (el contenido puede cambiar de tamaño).
  useLayoutEffect(() => {
    const element = ref.current
    const target = anchor.current
    if (!open || !element || !target) return
    const rect = target.getBoundingClientRect()
    const style = element.style
    style.maxHeight = ''
    if (matchAnchorWidth) style.minWidth = `${rect.width}px`
    const { width, height } = element.getBoundingClientRect()
    const left = align === 'end' ? rect.right - width : rect.left
    const spaceBelow = window.innerHeight - rect.bottom - MARGIN
    const placeAbove = height > spaceBelow && rect.top - MARGIN > spaceBelow
    style.left = `${Math.max(MARGIN, Math.min(left, window.innerWidth - width - MARGIN))}px`
    style.top = `${placeAbove ? Math.max(MARGIN, rect.top - height - GAP) : rect.bottom + GAP}px`
    style.maxHeight = `${Math.max(160, (placeAbove ? rect.top : spaceBelow) - GAP)}px`
  })

  useEffect(() => {
    if (!open) return
    const close = () => onOpenChange(false)
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (ref.current?.contains(target) || anchor.current?.contains(target)) return
      close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      close()
      anchor.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('resize', close)
    }
  }, [open, onOpenChange, anchor])

  return (
    <div ref={ref} popover="manual" aria-label={label} className={`popover${className ? ` ${className}` : ''}`}>
      {open && children}
    </div>
  )
}
