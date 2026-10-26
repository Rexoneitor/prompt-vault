import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { VaultError } from '@shared/errors'
import { MIGRATIONS, SCHEMA_VERSION } from './migrations'

export type Db = DatabaseSync

/** Valores admitidos por SQLite: los booleanos se guardan como 0/1. */
export type SqlValue = string | number | null

export function flag(value: boolean): number {
  return value ? 1 : 0
}

export function all<T>(db: Db, sql: string, ...params: SqlValue[]): T[] {
  return db.prepare(sql).all(...params) as T[]
}

export function one<T>(db: Db, sql: string, ...params: SqlValue[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined
}

export function run(db: Db, sql: string, ...params: SqlValue[]): number {
  return Number(db.prepare(sql).run(...params).changes)
}

/** Marcadores `?,?,?` para una cláusula IN. */
export function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(',')
}

/**
 * Abre (y migra) la base de datos. `:memory:` se usa en los tests.
 * Antes de migrar una base existente se deja una copia `*.pre-v<N>.bak` por si algo sale mal.
 */
export function openDatabase(path: string): Db {
  const isMemory = path === ':memory:'
  if (!isMemory) mkdirSync(dirname(path), { recursive: true })

  let db: Db
  try {
    db = new DatabaseSync(path)
    db.exec('PRAGMA foreign_keys = ON')
    if (!isMemory) db.exec('PRAGMA journal_mode = WAL')
    db.exec('PRAGMA synchronous = NORMAL')
  } catch (error) {
    throw new VaultError('STORAGE', `No se pudo abrir la base de datos: ${(error as Error).message}`)
  }

  const current = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version
  if (current > SCHEMA_VERSION) {
    db.close()
    throw new VaultError('STORAGE', 'La base de datos fue creada por una versión más reciente de Prompt Vault. Actualiza la aplicación.')
  }
  if (current < SCHEMA_VERSION) {
    if (!isMemory && current > 0 && existsSync(path)) {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
      copyFileSync(path, `${path}.pre-v${SCHEMA_VERSION}.bak`)
    }
    migrate(db, current)
  }
  return db
}

function migrate(db: Db, from: number): void {
  for (let version = from + 1; version <= SCHEMA_VERSION; version++) {
    const migration = MIGRATIONS[version - 1]
    transaction(db, () => {
      db.exec(migration)
      db.exec(`PRAGMA user_version = ${version}`)
    })
  }
}

/** Ejecuta `work` dentro de una transacción; si lanza, deshace todo. Admite anidamiento (se une a la externa). */
export function transaction<T>(db: Db, work: () => T): T {
  if (db.isTransaction) return work()
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = work()
    db.exec('COMMIT')
    return result
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK')
    throw error
  }
}

/** Copia consistente de la base de datos (segura con WAL activo). */
export function snapshotTo(db: Db, destination: string): void {
  mkdirSync(dirname(destination), { recursive: true })
  db.prepare('VACUUM INTO ?').run(destination)
}
