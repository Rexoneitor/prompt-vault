import { useEffect, useMemo } from 'react'
import { RouterProvider, createHashRouter, useLocation, useParams } from 'react-router-dom'
import { FileX } from 'lucide-react'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { Logo } from '@/components/Logo'
import { EditorPage } from '@/features/editor/EditorPage'
import { HomePage } from '@/features/home/HomePage'
import { LibraryPage } from '@/features/library/LibraryPage'
import type { Scope } from '@/features/library/filtering'
import { OrganizePage } from '@/features/organize/OrganizePage'
import { PromptPage } from '@/features/prompt/PromptPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { useLibrary } from '@/store/library'
import { Shell } from './Shell'

const ALL: Scope = { kind: 'all' }
const FAVORITES: Scope = { kind: 'favorites' }
const RECENT: Scope = { kind: 'recent' }
const ARCHIVED: Scope = { kind: 'archived' }

function ScopedLibrary({ kind }: { kind: 'category' | 'project' | 'tag' }) {
  const { id = '' } = useParams()
  const scope = useMemo<Scope>(() => ({ kind, id }), [kind, id])
  return <LibraryPage key={`${kind}:${id}`} scope={scope} />
}

/** Cada visita al editor es una instancia nueva: así «Nuevo prompt» siempre empieza limpio. */
function EditorRoute() {
  const location = useLocation()
  return <EditorPage key={location.key} />
}

function NotFound() {
  return (
    <div className="page page-center">
      <EmptyState
        icon={<FileX size={24} />}
        title="Esta página no existe."
        message="Comprueba la dirección o vuelve al inicio."
        actions={
          <Button variant="primary" onClick={() => (window.location.hash = '#/')}>
            Ir al inicio
          </Button>
        }
      />
    </div>
  )
}

const router = createHashRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'library', element: <LibraryPage key="all" scope={ALL} /> },
      { path: 'favorites', element: <LibraryPage key="favorites" scope={FAVORITES} /> },
      { path: 'recent', element: <LibraryPage key="recent" scope={RECENT} /> },
      { path: 'archived', element: <LibraryPage key="archived" scope={ARCHIVED} /> },
      { path: 'category/:id', element: <ScopedLibrary kind="category" /> },
      { path: 'project/:id', element: <ScopedLibrary kind="project" /> },
      { path: 'tag/:id', element: <ScopedLibrary kind="tag" /> },
      { path: 'prompt/:id', element: <PromptPage /> },
      { path: 'prompt/:id/edit', element: <EditorRoute /> },
      { path: 'new', element: <EditorRoute /> },
      { path: 'organize', element: <OrganizePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

export function App() {
  const status = useLibrary((s) => s.status)
  const loadError = useLibrary((s) => s.loadError)

  useEffect(() => {
    void useLibrary.getState().load()
  }, [])

  if (status === 'loading') {
    return (
      <div className="splash" aria-busy="true">
        <Logo size={44} />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="splash">
        <EmptyState
          icon={<FileX size={24} />}
          title="No se pudo abrir tu biblioteca."
          message={loadError ?? 'Ha ocurrido un error inesperado.'}
          actions={
            <Button variant="primary" onClick={() => void useLibrary.getState().load()}>
              Reintentar
            </Button>
          }
        />
      </div>
    )
  }

  return <RouterProvider router={router} />
}
