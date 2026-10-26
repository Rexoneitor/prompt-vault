import { randomUUID } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { VaultApi } from '@shared/api'
import { runDailyBackup, snapshotBeforeRestore } from './auto-backup'
import { openDatabase, type Db } from './db'
import { seedDefaults } from './seed'
import { VaultService } from './vault-service'

export interface Vault {
  api: VaultApi
  close(): void
}

function fileSize(path: string): number {
  return existsSync(path) ? statSync(path).size : 0
}

/** Abre la biblioteca local en `dataDir`: base de datos, datos iniciales y copias automáticas. */
export function createVault(dataDir: string): Vault {
  const dbPath = join(dataDir, 'vault.db')
  const backupsDir = join(dataDir, 'backups')
  const db: Db = openDatabase(dbPath)

  seedDefaults(db, randomUUID, new Date().toISOString())
  runDailyBackup(db, backupsDir)

  const api = new VaultService(db, {
    safetySnapshot: () => snapshotBeforeRestore(db, backupsDir),
    storageInfo: () => ({
      engine: 'SQLite',
      location: dbPath,
      backupsDir,
      sizeBytes: fileSize(dbPath) + fileSize(`${dbPath}-wal`),
    }),
  })

  return { api, close: () => db.close() }
}
