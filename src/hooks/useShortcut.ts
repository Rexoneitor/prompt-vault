import { useEffect, useRef } from 'react'
import { isMac } from '@/api/platform'

/**
 * Combinaciones: «mod+k», «mod+shift+c», «/», «escape». `mod` es ⌘ en macOS y Ctrl en el resto.
 * Las teclas sueltas (sin `mod`) no se disparan mientras se escribe en un campo.
 */
export function matchesShortcut(event: KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split('+')
  const key = parts[parts.length - 1]
  const wantsMod = parts.includes('mod')
  const wantsShift = parts.includes('shift')
  const wantsAlt = parts.includes('alt')
  const hasMod = isMac ? event.metaKey : event.ctrlKey
  const otherMod = isMac ? event.ctrlKey : event.metaKey
  // En teclados como el español «/» exige Shift: para símbolos y teclas de nombre largo, Shift no cuenta.
  const shiftMatches = wantsShift ? event.shiftKey : /^[a-z0-9]$/.test(key) ? !event.shiftKey : true
  return event.key.toLowerCase() === key && hasMod === wantsMod && !otherMod && shiftMatches && event.altKey === wantsAlt
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

interface ShortcutOptions {
  enabled?: boolean
}

export function useShortcut(combo: string, handler: (event: KeyboardEvent) => void, { enabled = true }: ShortcutOptions = {}): void {
  const latest = useRef(handler)
  latest.current = handler

  useEffect(() => {
    if (!enabled) return
    const needsMod = combo.toLowerCase().includes('mod')
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return
      if (!needsMod && isTypingTarget(event.target)) return
      if (!matchesShortcut(event, combo)) return
      event.preventDefault()
      latest.current(event)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [combo, enabled])
}
