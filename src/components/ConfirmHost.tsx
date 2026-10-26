import { useUi } from '@/store/ui'
import { Button } from './Button'
import { Dialog } from './Dialog'

/** Diálogo de confirmación global: `await useUi.getState().confirm({...})` desde cualquier sitio. */
export function ConfirmHost() {
  const request = useUi((state) => state.confirmRequest)
  const resolve = useUi((state) => state.resolveConfirm)
  if (!request) return null
  const { options } = request

  return (
    <Dialog
      size="sm"
      title={options.title}
      onClose={() => resolve('cancel')}
      footer={
        <>
          {/* En acciones destructivas el foco inicial va a «Cancelar»: un Enter accidental no debe borrar nada. */}
          <Button variant="ghost" onClick={() => resolve('cancel')} data-autofocus={options.danger ? '' : undefined}>
            Cancelar
          </Button>
          {options.alternativeLabel && (
            <Button variant="secondary" onClick={() => resolve('alternative')}>
              {options.alternativeLabel}
            </Button>
          )}
          <Button
            variant={options.danger ? 'danger' : 'primary'}
            onClick={() => resolve('confirm')}
            data-autofocus={options.danger ? undefined : ''}
          >
            {options.confirmLabel}
          </Button>
        </>
      }
    >
      {options.message && <p className="dialog-text">{options.message}</p>}
    </Dialog>
  )
}
