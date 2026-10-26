import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Database, Download, FolderOpen, Monitor, Moon, ShieldCheck, Sun, Upload } from 'lucide-react'
import { api } from '@/api/client'
import { isDesktop, revealDataFolder } from '@/api/platform'
import { Button } from '@/components/Button'
import { SegmentedControl } from '@/components/SegmentedControl'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useLibrary } from '@/store/library'
import { attempt, useUi } from '@/store/ui'
import { formatDateTime } from '@/utils/date'
import { pluralize } from '@shared/text'
import type { StorageInfo } from '@shared/types'
import { runBackup, runRestore } from '../data/actions'
import { ShortcutsList } from '../dialogs/ShortcutsDialog'

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="settings-section">
      <header className="settings-section-header">
        <h2 className="settings-section-title">{title}</h2>
        {description && <p className="settings-section-description">{description}</p>}
      </header>
      <div className="settings-card">{children}</div>
    </section>
  )
}

function Row({ title, description, children }: { title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="settings-row">
      <div className="settings-row-text">
        <p className="settings-row-title">{title}</p>
        {description && <p className="settings-row-description">{description}</p>}
      </div>
      {children && <div className="settings-row-control">{children}</div>}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function SettingsPage() {
  useDocumentTitle('Ajustes')
  const theme = useUi((s) => s.theme)
  const setTheme = useUi((s) => s.setTheme)
  const openDialog = useUi((s) => s.openDialog)
  const prompts = useLibrary((s) => s.prompts)
  const lastBackupAt = useLibrary((s) => s.settings.lastBackupAt)
  const [storage, setStorage] = useState<StorageInfo | null>(null)
  const [busy, setBusy] = useState<'backup' | 'restore' | 'demo' | null>(null)

  const demoCount = useMemo(() => prompts.filter((p) => p.isDemo).length, [prompts])

  useEffect(() => {
    void api.getStorageInfo().then(setStorage, () => setStorage(null))
  }, [prompts.length, lastBackupAt])

  const withBusy = async (kind: 'backup' | 'restore' | 'demo', work: () => Promise<unknown>) => {
    setBusy(kind)
    await work()
    setBusy(null)
  }

  const loadDemo = () =>
    withBusy('demo', async () => {
      const added = await attempt(async () => {
        const count = await api.loadDemoData()
        await useLibrary.getState().load()
        await useLibrary.getState().markWelcomeDone()
        return count
      })
      if (added !== undefined)
        useUi
          .getState()
          .toast(
            added === 0
              ? 'Los datos de ejemplo ya estaban cargados.'
              : `${pluralize(added, 'prompt de ejemplo cargado', 'prompts de ejemplo cargados')}.`,
            'info',
          )
    })

  const removeDemo = async () => {
    const answer = await useUi.getState().confirm({
      title: 'Eliminar los datos de ejemplo',
      message: `Se borrarán ${pluralize(demoCount, 'prompt', 'prompts')} marcados como «Demo» (y los proyectos de ejemplo). Tus propios prompts no se tocan; si editaste uno de ejemplo, ya cuenta como tuyo y se conserva.`,
      confirmLabel: 'Eliminar ejemplos',
      danger: true,
    })
    if (answer !== 'confirm') return
    await withBusy('demo', async () => {
      const removed = await attempt(async () => {
        const count = await api.removeDemoData()
        await useLibrary.getState().load()
        return count
      })
      if (removed !== undefined)
        useUi.getState().toast(`${pluralize(removed, 'prompt de ejemplo eliminado', 'prompts de ejemplo eliminados')}.`)
    })
  }

  return (
    <div className="page page-narrow">
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title serif">Ajustes</h1>
          <p className="page-subtitle">Apariencia, tus datos y atajos.</p>
        </div>
      </header>

      <Section title="Apariencia">
        <Row title="Tema" description="«Sistema» sigue el modo claro u oscuro de tu equipo.">
          <SegmentedControl
            label="Tema"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: 'Claro', icon: <Sun size={15} /> },
              { value: 'dark', label: 'Oscuro', icon: <Moon size={15} /> },
              { value: 'system', label: 'Sistema', icon: <Monitor size={15} /> },
            ]}
          />
        </Row>
      </Section>

      <Section title="Tus datos" description="Tu biblioteca vive solo en este equipo. Nada se envía a ningún servidor.">
        <Row
          title="Dónde se guardan"
          description={
            <>
              {storage ? (
                <>
                  <code className="path">{storage.location || 'En memoria'}</code>
                  <br />
                  {storage.engine} · {formatBytes(storage.sizeBytes)} · {pluralize(prompts.length, 'prompt', 'prompts')}
                  {storage.backupsDir && (
                    <>
                      {' '}
                      · copias automáticas diarias en <code className="path">{storage.backupsDir}</code>
                    </>
                  )}
                </>
              ) : (
                'Consultando…'
              )}
            </>
          }
        >
          {isDesktop && (
            <Button variant="secondary" icon={<FolderOpen size={15} />} onClick={revealDataFolder}>
              Mostrar carpeta
            </Button>
          )}
        </Row>
        <Row
          title="Privacidad"
          description="Sin cuentas, sin telemetría y sin conexiones externas: la aplicación bloquea las peticiones de red y todas las funciones trabajan en local."
        >
          <span className="privacy-pill">
            <ShieldCheck size={15} aria-hidden /> 100 % local
          </span>
        </Row>
      </Section>

      <Section title="Copia de seguridad" description="Un único archivo JSON con toda tu biblioteca, versiones incluidas.">
        <Row
          title="Crear backup"
          description={lastBackupAt ? `Último backup: ${formatDateTime(lastBackupAt)}.` : 'Aún no has hecho ningún backup.'}
        >
          <Button
            variant="primary"
            icon={<Download size={15} />}
            loading={busy === 'backup'}
            onClick={() => void withBusy('backup', runBackup)}
          >
            Crear backup
          </Button>
        </Row>
        <Row
          title="Restaurar backup"
          description="Reemplaza tu biblioteca actual por la de un archivo de backup. Antes se guarda una copia automática de seguridad."
        >
          <Button
            variant="secondary"
            icon={<Upload size={15} />}
            loading={busy === 'restore'}
            onClick={() => void withBusy('restore', runRestore)}
          >
            Restaurar…
          </Button>
        </Row>
      </Section>

      <Section title="Importar y exportar">
        <Row
          title="Importar prompts"
          description="Desde JSON, CSV, Markdown, TXT o pegando texto. Antes de importar ves una vista previa y se detectan duplicados."
        >
          <Button variant="secondary" icon={<Upload size={15} />} onClick={() => openDialog({ type: 'import' })}>
            Importar…
          </Button>
        </Row>
        <Row
          title="Exportar biblioteca"
          description="JSON completo, CSV, Markdown o texto. También puedes exportar una selección desde la biblioteca."
        >
          <Button
            variant="secondary"
            icon={<Database size={15} />}
            onClick={() => openDialog({ type: 'export' })}
            disabled={prompts.length === 0}
          >
            Exportar…
          </Button>
        </Row>
      </Section>

      <Section
        title="Datos de demostración"
        description="Prompts de ejemplo, claramente marcados como «Demo», para explorar la aplicación sin mezclarlos con los tuyos."
      >
        <Row
          title={
            demoCount > 0 ? `${pluralize(demoCount, 'prompt de ejemplo cargado', 'prompts de ejemplo cargados')}` : 'Sin datos de ejemplo'
          }
        >
          {demoCount > 0 ? (
            <Button variant="danger" loading={busy === 'demo'} onClick={() => void removeDemo()}>
              Eliminar ejemplos
            </Button>
          ) : (
            <Button variant="secondary" loading={busy === 'demo'} onClick={() => void loadDemo()}>
              Cargar ejemplos
            </Button>
          )}
        </Row>
      </Section>

      <Section title="Atajos de teclado">
        <div className="settings-pad">
          <ShortcutsList />
        </div>
      </Section>

      <p className="about">Prompt Vault {__APP_VERSION__} · hecho para guardar y reutilizar tus mejores prompts.</p>
    </div>
  )
}
