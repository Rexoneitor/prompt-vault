import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { snapshotTo, type Db } from './db'

/**
 * Copias de seguridad automáticas de la base de datos (archivos SQLite completos).
 * Son una red de seguridad local; el backup «de usuario» es el JSON exportable.
 */

const DAILY_KEEP = 7
const RESTORE_KEEP = 3

function pruneOld(dir: string, prefix: string, keep: number): void {
  const files = readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.db'))
    .map((name) => ({ name, mtime: statSync(join(dir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
  for (const stale of files.slice(keep)) rmSync(join(dir, stale.name), { force: true })
}

/** Una copia por día natural; conserva las últimas 7. Nunca debe impedir que la app arranque. */
export function runDailyBackup(db: Db, dir: string, now: Date = new Date()): void {
  try {
    const target = join(dir, `auto-${now.toISOString().slice(0, 10)}.db`)
    if (existsSync(target)) return
    snapshotTo(db, target)
    pruneOld(dir, 'auto-', DAILY_KEEP)
  } catch (error) {
    console.error('[prompt-vault] No se pudo crear la copia automática:', error)
  }
}

/** Copia previa a una restauración, por si el usuario se arrepiente. Conserva las últimas 3. */
export function snapshotBeforeRestore(db: Db, dir: string, now: Date = new Date()): void {
  const stamp = now.toISOString().replace(/[:.]/g, '-')
  snapshotTo(db, join(dir, `pre-restore-${stamp}.db`))
  pruneOld(dir, 'pre-restore-', RESTORE_KEEP)
}
