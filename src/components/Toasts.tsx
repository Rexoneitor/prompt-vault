import { AlertCircle, Check, Info, X } from 'lucide-react'
import { useUi, type ToastKind } from '@/store/ui'

const ICONS: Record<ToastKind, typeof Check> = { success: Check, error: AlertCircle, info: Info }

export function Toasts() {
  const toasts = useUi((state) => state.toasts)
  const dismiss = useUi((state) => state.dismissToast)

  return (
    <div className="toasts" role="region" aria-label="Notificaciones" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.kind]
        return (
          <div key={toast.id} className={`toast toast-${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
            <Icon size={16} aria-hidden />
            <span className="toast-message">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  toast.action?.run()
                  dismiss(toast.id)
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button type="button" className="toast-close" aria-label="Cerrar aviso" onClick={() => dismiss(toast.id)}>
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
