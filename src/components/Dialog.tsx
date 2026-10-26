import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './Button'

interface DialogProps {
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Si es false, ni Esc ni el clic fuera cierran el diálogo (p. ej. mientras se guarda). */
  dismissible?: boolean
}

/**
 * Diálogo modal sobre `<dialog>` nativo: foco atrapado, Esc, fondo inerte y accesibilidad gratis.
 * Se monta solo mientras está abierto, así los formularios siempre empiezan limpios.
 */
export function Dialog({ title, description, onClose, children, footer, size = 'md', dismissible = true }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    // showModal() enfoca el primer elemento (el botón de cerrar); mejor llevar el foco a donde se escribe o se decide.
    const target =
      dialog.querySelector<HTMLElement>('[data-autofocus]') ??
      dialog.querySelector<HTMLElement>('.dialog-body input:not([type="checkbox"]), .dialog-body textarea')
    target?.focus()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={ref}
      className={`dialog dialog-${size}`}
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        if (dismissible) onClose()
      }}
      onMouseDown={(event) => {
        if (dismissible && event.target === ref.current) onClose()
      }}
    >
      <div className="dialog-panel">
        <header className="dialog-header">
          <div>
            <h2 id="dialog-title" className="dialog-title">
              {title}
            </h2>
            {description && <p className="dialog-description">{description}</p>}
          </div>
          {dismissible && (
            <IconButton label="Cerrar" size="sm" onClick={onClose}>
              <X size={16} />
            </IconButton>
          )}
        </header>
        <div className="dialog-body">{children}</div>
        {footer && <footer className="dialog-footer">{footer}</footer>}
      </div>
    </dialog>
  )
}
