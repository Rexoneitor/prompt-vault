import { isApiMethod, type VaultApi } from '@shared/api'
import { toSerializedError, type RpcResult } from '@shared/errors'

/**
 * Despacha una llamada `{ method, args }` a la API, devolviendo siempre un `RpcResult`.
 * Solo se pueden invocar los métodos de la lista blanca `API_METHODS`.
 */
export async function dispatchRpc(api: VaultApi, method: unknown, args: unknown): Promise<RpcResult> {
  try {
    if (typeof method !== 'string' || !isApiMethod(method)) {
      return { ok: false, error: { code: 'VALIDATION', message: `Método desconocido: ${String(method)}` } }
    }
    const params = Array.isArray(args) ? args : []
    const fn = api[method] as (...input: unknown[]) => Promise<unknown>
    return { ok: true, value: await fn.apply(api, params) }
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'VaultError') console.error('[prompt-vault]', error)
    return { ok: false, error: toSerializedError(error) }
  }
}
