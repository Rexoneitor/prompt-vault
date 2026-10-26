import { useMemo, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Archive,
  ChevronDown,
  Clock,
  Home,
  Library,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Star,
  Sun,
} from 'lucide-react'
import { Button, IconButton } from '@/components/Button'
import { ColorDot } from '@/components/ColorDot'
import { Kbd } from '@/components/Kbd'
import { Logo } from '@/components/Logo'
import { useLibrary } from '@/store/library'
import { useUi } from '@/store/ui'

const MAX_SIDEBAR_TAGS = 10

function NavItem({ to, icon, children, count, end }: { to: string; icon?: ReactNode; children: ReactNode; count?: number; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}>
      {icon}
      <span className="nav-item-label truncate">{children}</span>
      {count !== undefined && count > 0 && <span className="nav-item-count">{count}</span>}
    </NavLink>
  )
}

interface SectionProps {
  id: string
  title: string
  defaultCollapsed?: boolean
  onAdd?: () => void
  addLabel?: string
  children: ReactNode
}

function Section({ id, title, defaultCollapsed = false, onAdd, addLabel, children }: SectionProps) {
  const collapsed = useUi((s) => s.collapsedSections[id] ?? defaultCollapsed)
  const toggle = useUi((s) => s.toggleSection)
  return (
    <section className="nav-section">
      <div className="nav-section-header">
        <button type="button" className="nav-section-toggle" aria-expanded={!collapsed} onClick={() => toggle(id, defaultCollapsed)}>
          <ChevronDown size={13} className={collapsed ? 'is-collapsed' : ''} aria-hidden />
          {title}
        </button>
        {onAdd && (
          <IconButton label={addLabel ?? 'Añadir'} size="sm" tipSide="bottom" onClick={onAdd}>
            <Plus size={14} />
          </IconButton>
        )}
      </div>
      {!collapsed && <div className="nav-section-body">{children}</div>}
    </section>
  )
}

function ThemeButton() {
  const theme = useUi((s) => s.theme)
  const setTheme = useUi((s) => s.setTheme)
  const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
  const labels = { system: 'Tema: sistema', light: 'Tema: claro', dark: 'Tema: oscuro' } as const
  const Icon = theme === 'system' ? Monitor : theme === 'light' ? Sun : Moon
  return (
    <IconButton label={`${labels[theme]} (clic para cambiar)`} tipSide="top" onClick={() => setTheme(next)}>
      <Icon size={17} />
    </IconButton>
  )
}

export function Sidebar() {
  const navigate = useNavigate()
  const prompts = useLibrary((s) => s.prompts)
  const categories = useLibrary((s) => s.categories)
  const projects = useLibrary((s) => s.projects)
  const tags = useLibrary((s) => s.tags)
  const openDialog = useUi((s) => s.openDialog)
  const setPaletteOpen = useUi((s) => s.setPaletteOpen)
  const drawerOpen = useUi((s) => s.drawerOpen)

  const counts = useMemo(() => {
    const byCategory = new Map<string, number>()
    const byProject = new Map<string, number>()
    const byTag = new Map<string, number>()
    let all = 0
    let favorites = 0
    let archived = 0
    for (const prompt of prompts) {
      if (prompt.archived) {
        archived++
        continue
      }
      all++
      if (prompt.favorite) favorites++
      if (prompt.categoryId) byCategory.set(prompt.categoryId, (byCategory.get(prompt.categoryId) ?? 0) + 1)
      if (prompt.projectId) byProject.set(prompt.projectId, (byProject.get(prompt.projectId) ?? 0) + 1)
      for (const tagId of prompt.tagIds) byTag.set(tagId, (byTag.get(tagId) ?? 0) + 1)
    }
    return { all, favorites, archived, byCategory, byProject, byTag }
  }, [prompts])

  const topTags = useMemo(
    () =>
      [...tags]
        .sort((a, b) => (counts.byTag.get(b.id) ?? 0) - (counts.byTag.get(a.id) ?? 0) || a.name.localeCompare(b.name, 'es'))
        .slice(0, MAX_SIDEBAR_TAGS),
    [tags, counts.byTag],
  )

  return (
    <aside className={`sidebar${drawerOpen ? ' is-open' : ''}`} aria-label="Navegación">
      <div className="sidebar-brand">
        <Logo size={26} />
        <span className="sidebar-brand-name">Prompt Vault</span>
      </div>

      <div className="sidebar-actions">
        <button type="button" className="sidebar-search" onClick={() => setPaletteOpen(true)}>
          <Search size={15} aria-hidden />
          <span>Buscar…</span>
          <Kbd keys={['mod', 'K']} />
        </button>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate('/new')}>
          Nuevo prompt
        </Button>
      </div>

      <nav className="sidebar-nav" aria-label="Biblioteca">
        <div className="nav-group">
          <NavItem to="/" end icon={<Home size={16} />}>
            Inicio
          </NavItem>
          <NavItem to="/library" icon={<Library size={16} />} count={counts.all}>
            Todos los prompts
          </NavItem>
          <NavItem to="/favorites" icon={<Star size={16} />} count={counts.favorites}>
            Favoritos
          </NavItem>
          <NavItem to="/recent" icon={<Clock size={16} />}>
            Recientes
          </NavItem>
        </div>

        <Section id="categories" title="Categorías" onAdd={() => openDialog({ type: 'category' })} addLabel="Nueva categoría">
          {categories.length === 0 && <p className="nav-empty">Aún no hay categorías.</p>}
          {categories.map((category) => (
            <NavItem
              key={category.id}
              to={`/category/${category.id}`}
              icon={<ColorDot color={category.color} />}
              count={counts.byCategory.get(category.id)}
            >
              {category.name}
            </NavItem>
          ))}
        </Section>

        <Section id="tags" title="Etiquetas" defaultCollapsed>
          {topTags.length === 0 && <p className="nav-empty">Las etiquetas aparecerán aquí.</p>}
          {topTags.map((tag) => (
            <NavItem key={tag.id} to={`/tag/${tag.id}`} icon={<span className="nav-hash">#</span>} count={counts.byTag.get(tag.id)}>
              {tag.name}
            </NavItem>
          ))}
          {tags.length > MAX_SIDEBAR_TAGS && (
            <NavLink to="/organize?tab=tags" className="nav-more">
              Ver las {tags.length} etiquetas
            </NavLink>
          )}
        </Section>

        <Section id="projects" title="Proyectos" onAdd={() => openDialog({ type: 'project' })} addLabel="Nuevo proyecto">
          {projects.length === 0 && <p className="nav-empty">Agrupa prompts por proyecto.</p>}
          {projects.map((project) => (
            <NavItem
              key={project.id}
              to={`/project/${project.id}`}
              icon={<span className="nav-hash">▸</span>}
              count={counts.byProject.get(project.id)}
            >
              {project.name}
            </NavItem>
          ))}
        </Section>
      </nav>

      <div className="sidebar-footer">
        <NavItem to="/archived" icon={<Archive size={16} />} count={counts.archived}>
          Archivados
        </NavItem>
        <NavItem to="/organize" icon={<SlidersHorizontal size={16} />}>
          Organizar
        </NavItem>
        <div className="sidebar-footer-row">
          <NavItem to="/settings" icon={<Settings size={16} />}>
            Ajustes
          </NavItem>
          <ThemeButton />
        </div>
      </div>
    </aside>
  )
}
