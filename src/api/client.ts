import { isApiMethod, type VaultApi } from '@shared/api'
import { VaultError, type RpcResult } from '@shared/errors'

type Transport = (method: string, args: unknown[]) => Promise<RpcResult>

/** Escritorio: IPC hacia el proceso principal. */
const ipcTransport: Transport = (method, args) => window.vaultBridge!.rpc(method, args)

/** Navegador: HTTP contra el backend local (futuro: el backend en la nube). */
const httpTransport: Transport = async (method, args) => {
  const response = await fetch('/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, args }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return (await response.json()) as RpcResult
}

function createClient(transport: Transport): VaultApi {
  return new Proxy({} as VaultApi, {
    get(_target, property) {
      if (typeof property !== 'string' || !isApiMethod(property)) return undefined
      return async (...args: unknown[]) => {
        let result: RpcResult
        try {
          result = await transport(property, args)
        } catch (error) {
          throw new VaultError('STORAGE', `No se pudo comunicar con el almacenamiento local (${(error as Error).message}).`)
        }
        if (!result.ok) throw new VaultError(result.error.code, result.error.message)
        return result.value
      }
    },
  })
}

/** Cliente único de la API. La interfaz nunca sabe qué hay detrás. */
export const api: VaultApi = createClient(window.vaultBridge ? ipcTransport : httpTransport)

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ha ocurrido un error inesperado.'
}
