import { useEffect } from 'react'

const APP_NAME = 'Prompt Vault'

/** Título de la ventana: «Sección · Prompt Vault» (se ve en la barra de tareas y al alternar ventanas). */
export function useDocumentTitle(section?: string): void {
  useEffect(() => {
    document.title = section ? `${section} · ${APP_NAME}` : APP_NAME
    return () => {
      document.title = APP_NAME
    }
  }, [section])
}
