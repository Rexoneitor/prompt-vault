import { Dialog } from '@/components/Dialog'
import { Kbd } from '@/components/Kbd'
import { useUi } from '@/store/ui'

export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['mod', 'K'], label: 'Buscar y paleta de comandos' },
  { keys: ['mod', 'N'], label: 'Nuevo prompt' },
  { keys: ['mod', 'S'], label: 'Guardar (en el editor)' },
  { keys: ['mod', 'Shift', 'C'], label: 'Copiar el prompt abierto' },
  { keys: ['/'], label: 'Ir al buscador de la biblioteca' },
  { keys: ['mod', '↵'], label: 'Copiar el prompt seleccionado (en la paleta)' },
  { keys: ['Esc'], label: 'Cerrar diálogo o paleta' },
]

export function ShortcutsList() {
  return (
    <ul className="shortcut-list">
      {SHORTCUTS.map((shortcut) => (
        <li key={shortcut.label}>
          <span>{shortcut.label}</span>
          <Kbd keys={shortcut.keys} />
        </li>
      ))}
    </ul>
  )
}

export function ShortcutsDialog() {
  const close = useUi((s) => s.closeDialog)
  return (
    <Dialog size="md" title="Atajos de teclado" onClose={close}>
      <ShortcutsList />
    </Dialog>
  )
}
