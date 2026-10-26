import { useCallback } from 'react'
import { copyText } from '@/api/platform'
import { errorMessage } from '@/api/client'
import { useLibrary } from '@/store/library'
import { useUi } from '@/store/ui'
import { truncate } from '@shared/text'
import type { Prompt } from '@shared/types'

interface CopyOptions {
  /** Texto a copiar en lugar del contenido original (p. ej. con variables completadas). */
  text?: string
  /** No muestra el aviso (cuando la propia interfaz ya da feedback, como el botón «Copiado»). */
  silent?: boolean
}

/** Copia un prompt al portapapeles y registra el uso (contador y «último uso»). */
export function useCopyPrompt() {
  return useCallback(async (prompt: Prompt, { text, silent }: CopyOptions = {}): Promise<boolean> => {
    try {
      await copyText(text ?? prompt.content)
    } catch (error) {
      useUi.getState().toast(errorMessage(error), 'error')
      return false
    }
    useLibrary.getState().recordCopy(prompt.id)
    if (!silent) useUi.getState().toast(`Copiado: ${truncate(prompt.title, 48)}`)
    return true
  }, [])
}
