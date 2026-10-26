import { useNavigate } from 'react-router-dom'
import { Compass, FilePlus2, Upload } from 'lucide-react'
import { api } from '@/api/client'
import { Logo } from '@/components/Logo'
import { useLibrary } from '@/store/library'
import { attempt, useUi } from '@/store/ui'

/** Primera pantalla: tres caminos, ningún tutorial. */
export function Welcome() {
  const navigate = useNavigate()
  const openDialog = useUi((s) => s.openDialog)

  const start = async () => {
    await useLibrary.getState().markWelcomeDone()
    navigate('/new')
  }

  const explore = async () => {
    const loaded = await attempt(async () => {
      await api.loadDemoData()
      await useLibrary.getState().load()
      await useLibrary.getState().markWelcomeDone()
      return true
    })
    if (!loaded) return
    useUi.getState().toast('Cargué prompts de ejemplo marcados como «Demo». Los puedes quitar en Ajustes cuando quieras.', 'info')
    navigate('/library')
  }

  return (
    <div className="welcome">
      <div className="welcome-mark">
        <Logo size={56} />
      </div>
      <h1 className="welcome-title serif">Bienvenido a Prompt Vault.</h1>
      <p className="welcome-subtitle">Tu biblioteca personal de prompts.</p>

      <div className="welcome-actions">
        <button type="button" className="welcome-card is-primary" onClick={() => void start()}>
          <FilePlus2 size={20} aria-hidden />
          <span className="welcome-card-title">Crear mi primer prompt</span>
          <span className="welcome-card-text">Empieza escribiendo uno. Tarda un minuto.</span>
        </button>
        <button type="button" className="welcome-card" onClick={() => openDialog({ type: 'import' })}>
          <Upload size={20} aria-hidden />
          <span className="welcome-card-title">Importar prompts</span>
          <span className="welcome-card-text">Desde JSON, CSV, Markdown, TXT o pegando texto.</span>
        </button>
        <button type="button" className="welcome-card" onClick={() => void explore()}>
          <Compass size={20} aria-hidden />
          <span className="welcome-card-title">Explorar la aplicación</span>
          <span className="welcome-card-text">Con unos prompts de ejemplo que podrás borrar.</span>
        </button>
      </div>

      <p className="welcome-privacy">Todo se guarda en este equipo. Sin cuenta, sin nube y sin telemetría.</p>
    </div>
  )
}
