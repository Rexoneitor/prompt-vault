import { useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Menu, Search } from 'lucide-react'
import { ConfirmHost } from '@/components/ConfirmHost'
import { IconButton } from '@/components/Button'
import { Logo } from '@/components/Logo'
import { Toasts } from '@/components/Toasts'
import { CommandPalette } from '@/features/palette/CommandPalette'
import { useShortcut } from '@/hooks/useShortcut'
import { useUi } from '@/store/ui'
import { DialogHost } from './DialogHost'
import { Sidebar } from './Sidebar'

export function Shell() {
  const location = useLocation()
  const navigate = useNavigate()
  const main = useRef<HTMLElement>(null)
  const drawerOpen = useUi((s) => s.drawerOpen)
  const setDrawerOpen = useUi((s) => s.setDrawerOpen)
  const paletteOpen = useUi((s) => s.paletteOpen)
  const setPaletteOpen = useUi((s) => s.setPaletteOpen)

  // Cada pantalla nueva empieza arriba; en móvil, el menú se cierra al navegar.
  useEffect(() => {
    main.current?.scrollTo({ top: 0 })
    setDrawerOpen(false)
  }, [location.pathname, setDrawerOpen])

  useShortcut('mod+k', () => setPaletteOpen(!paletteOpen))
  useShortcut('mod+n', () => {
    if (location.pathname !== '/new') navigate('/new')
  })

  return (
    <div className="shell">
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault()
          main.current?.focus()
        }}
      >
        Saltar al contenido
      </a>
      <Sidebar />
      {drawerOpen && <div className="drawer-scrim" onClick={() => setDrawerOpen(false)} aria-hidden />}

      <div className="shell-main">
        <header className="mobile-bar">
          <IconButton label="Abrir menú" onClick={() => setDrawerOpen(true)}>
            <Menu size={20} />
          </IconButton>
          <span className="mobile-bar-title">
            <Logo size={22} /> Prompt Vault
          </span>
          <IconButton label="Buscar" onClick={() => setPaletteOpen(true)}>
            <Search size={19} />
          </IconButton>
        </header>
        <main ref={main} className="page-scroll" id="main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <CommandPalette />
      <DialogHost />
      <ConfirmHost />
      <Toasts />
    </div>
  )
}
