import { useMemo, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Plus, Search, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/Button'
import { Kbd } from '@/components/Kbd'
import { PromptCard } from '@/features/library/PromptItems'
import { Welcome } from '@/features/welcome/Welcome'
import { useLibrary } from '@/store/library'
import { useUi } from '@/store/ui'
import { daysSince, greeting } from '@/utils/date'
import type { Prompt } from '@shared/types'
import { runBackup } from '../data/actions'

const SECTION_SIZE = 4
const WEEK = 7
const BACKUP_REMINDER_DAYS = 30
const BACKUP_REMINDER_MIN_PROMPTS = 5

function Stat({ value, label, to }: { value: number; label: string; to: string }) {
  return (
    <Link to={to} className="stat">
      <span className="stat-value serif">{value}</span>
      <span className="stat-label">{label}</span>
    </Link>
  )
}

function Section({ title, to, linkLabel, prompts }: { title: string; to: string; linkLabel: string; prompts: Prompt[] }) {
  if (prompts.length === 0) return null
  return (
    <section className="home-section">
      <header className="home-section-header">
        <h2 className="home-section-title">{title}</h2>
        <Link to={to} className="home-section-link">
          {linkLabel} <ArrowRight size={14} aria-hidden />
        </Link>
      </header>
      <div className="grid grid-home" role="list">
        {prompts.map((prompt) => (
          <PromptCard key={prompt.id} prompt={prompt} />
        ))}
      </div>
    </section>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const prompts = useLibrary((s) => s.prompts)
  const categories = useLibrary((s) => s.categories)
  const settings = useLibrary((s) => s.settings)
  const setPaletteOpen = useUi((s) => s.setPaletteOpen)

  const data = useMemo(() => {
    const active = prompts.filter((p) => !p.archived)
    const favorites = active.filter((p) => p.favorite)
    const usedThisWeek = active.filter((p) => (daysSince(p.lastUsedAt) ?? Infinity) < WEEK)
    const recent = [...active]
      .filter((p) => p.lastUsedAt)
      .sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''))
      .slice(0, SECTION_SIZE)
    const favoriteList = [...favorites].sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '')).slice(0, SECTION_SIZE)
    // «Últimos añadidos» no repite lo que ya se muestra arriba como reciente.
    const recentIds = new Set(recent.map((p) => p.id))
    const latest = [...active]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((p) => !recentIds.has(p.id))
      .slice(0, SECTION_SIZE)
    return { active, favorites, usedThisWeek, recent, favoriteList, latest }
  }, [prompts])

  if (prompts.length === 0) {
    return (
      <div className="page page-center">
        {settings.welcomeDone ? (
          <div className="welcome">
            <h1 className="welcome-title serif">Tu biblioteca está vacía.</h1>
            <p className="welcome-subtitle">Crea un prompt o importa los que ya tienes.</p>
            <div className="welcome-buttons">
              <Button variant="primary" size="lg" icon={<Plus size={18} />} onClick={() => navigate('/new')}>
                Nuevo prompt
              </Button>
              <Button variant="secondary" size="lg" onClick={() => useUi.getState().openDialog({ type: 'import' })}>
                Importar
              </Button>
            </div>
          </div>
        ) : (
          <Welcome />
        )}
      </div>
    )
  }

  const daysSinceBackup = daysSince(settings.lastBackupAt)
  const needsBackup =
    data.active.length >= BACKUP_REMINDER_MIN_PROMPTS && (settings.lastBackupAt === null || (daysSinceBackup ?? 0) >= BACKUP_REMINDER_DAYS)

  let reminder: ReactNode = null
  if (needsBackup) {
    reminder = (
      <div className="callout">
        <ShieldAlert size={18} aria-hidden />
        <p>
          {settings.lastBackupAt === null ? 'Aún no has hecho ningún backup.' : `Hace ${daysSinceBackup} días que no haces un backup.`} Tus
          prompts son tuyos: guarda una copia.
        </p>
        <Button size="sm" variant="secondary" onClick={() => void runBackup()}>
          Hacer backup
        </Button>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="home-header">
        <div>
          <p className="home-greeting">{greeting()}</p>
          <h1 className="home-title serif">Tu biblioteca de prompts</h1>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate('/new')}>
            Nuevo prompt
          </Button>
        </div>
      </header>

      <button type="button" className="home-search" onClick={() => setPaletteOpen(true)}>
        <Search size={18} aria-hidden />
        <span>Buscar en tu biblioteca…</span>
        <Kbd keys={['mod', 'K']} />
      </button>

      <div className="stats">
        <Stat value={data.active.length} label={data.active.length === 1 ? 'Prompt' : 'Prompts'} to="/library" />
        <Stat value={data.favorites.length} label={data.favorites.length === 1 ? 'Favorito' : 'Favoritos'} to="/favorites" />
        <Stat value={categories.length} label={categories.length === 1 ? 'Categoría' : 'Categorías'} to="/organize" />
        <Stat value={data.usedThisWeek.length} label="Usados esta semana" to="/recent" />
      </div>

      {reminder}

      <Section title="Usados recientemente" to="/recent" linkLabel="Ver recientes" prompts={data.recent} />
      <Section title="Favoritos" to="/favorites" linkLabel="Ver favoritos" prompts={data.favoriteList} />
      <Section title="Últimos añadidos" to="/library" linkLabel="Ver todos" prompts={data.latest} />
    </div>
  )
}
