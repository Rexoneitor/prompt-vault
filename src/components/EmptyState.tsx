import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  message: string
  actions?: ReactNode
  compact?: boolean
}

export function EmptyState({ icon, title, message, actions, compact }: EmptyStateProps) {
  return (
    <div className={`empty-state${compact ? ' is-compact' : ''}`}>
      <div className="empty-state-icon" aria-hidden>
        {icon}
      </div>
      <h2 className="empty-state-title">{title}</h2>
      <p className="empty-state-message">{message}</p>
      {actions && <div className="empty-state-actions">{actions}</div>}
    </div>
  )
}
