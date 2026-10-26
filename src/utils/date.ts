const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
const longDate = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const shortDate = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' })
const shortDateYear = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' })

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** «hace 3 h», «ayer», «12 sept»: lo justo para escanear una lista. */
export function relativeTime(iso: string | null, now: number = Date.now()): string {
  if (!iso) return 'nunca'
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return '—'
  const diff = Math.max(0, now - then)
  if (diff < MINUTE) return 'ahora mismo'
  if (diff < HOUR) return `hace ${Math.floor(diff / MINUTE)} min`
  if (diff < DAY) return `hace ${Math.floor(diff / HOUR)} h`
  if (diff < 7 * DAY) return relative.format(-Math.floor(diff / DAY), 'day')
  const date = new Date(then)
  return date.getFullYear() === new Date(now).getFullYear() ? shortDate.format(date) : shortDateYear.format(date)
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : longDate.format(date)
}

export function daysSince(iso: string | null, now: number = Date.now()): number | null {
  if (!iso) return null
  const then = Date.parse(iso)
  return Number.isNaN(then) ? null : Math.floor((now - then) / DAY)
}

export function greeting(date: Date = new Date()): string {
  const hour = date.getHours()
  if (hour < 6) return 'Buenas noches'
  if (hour < 13) return 'Buenos días'
  if (hour < 20) return 'Buenas tardes'
  return 'Buenas noches'
}
