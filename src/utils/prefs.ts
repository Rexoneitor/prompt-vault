/**
 * Preferencias de interfaz en localStorage (tema, vista, orden…). Son del dispositivo, no de la biblioteca.
 * El almacenamiento puede no estar disponible (modo privado, datos bloqueados): todo falla en silencio.
 */
const PREFIX = 'pv:'

export function readPref<T>(key: string, fallback: T, isValid: (value: unknown) => value is T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    const value: unknown = JSON.parse(raw)
    return isValid(value) ? value : fallback
  } catch {
    return fallback
  }
}

export function writePref(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Sin persistencia: la preferencia vale solo durante esta sesión.
  }
}
