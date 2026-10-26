export type ErrorCode = 'VALIDATION' | 'NOT_FOUND' | 'CONFLICT' | 'IMPORT_INVALID' | 'BACKUP_INVALID' | 'STORAGE' | 'INTERNAL'

/** Error de dominio que cruza cualquier transporte (IPC, HTTP) con su código intacto. */
export class VaultError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode, message: string) {
    super(message)
    this.name = 'VaultError'
    this.code = code
  }
}

export interface SerializedError {
  code: ErrorCode
  message: string
}

/** Envoltorio de respuesta común a todos los transportes. */
export type RpcResult<T = unknown> = { ok: true; value: T } | { ok: false; error: SerializedError }

export function toSerializedError(error: unknown): SerializedError {
  if (error instanceof VaultError) return { code: error.code, message: error.message }
  const message = error instanceof Error ? error.message : String(error)
  return { code: 'INTERNAL', message }
}
