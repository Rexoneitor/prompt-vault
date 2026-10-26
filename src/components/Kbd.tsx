import { modKeyLabel } from '@/api/platform'

/** Muestra un atajo; «mod» se traduce a ⌘ o Ctrl según el sistema. */
export function Kbd({ keys }: { keys: string[] }) {
  return (
    <span className="kbd-group">
      {keys.map((key) => (
        <kbd key={key} className="kbd">
          {key === 'mod' ? modKeyLabel : key}
        </kbd>
      ))}
    </span>
  )
}
