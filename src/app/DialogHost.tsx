import { ExportDialog } from '@/features/dialogs/ExportDialog'
import { ImportDialog } from '@/features/dialogs/ImportDialog'
import { ShortcutsDialog } from '@/features/dialogs/ShortcutsDialog'
import { CategoryDialog, ProjectDialog, ToolDialog } from '@/features/dialogs/TaxonomyDialogs'
import { VersionDialog } from '@/features/dialogs/VersionDialog'
import { useUi } from '@/store/ui'

/** Monta el diálogo global activo (los abre cualquier parte de la app con `openDialog`). */
export function DialogHost() {
  const dialog = useUi((s) => s.dialog)
  if (!dialog) return null
  switch (dialog.type) {
    case 'category':
      return <CategoryDialog id={dialog.id} />
    case 'project':
      return <ProjectDialog id={dialog.id} />
    case 'tool':
      return <ToolDialog id={dialog.id} />
    case 'version':
      return <VersionDialog promptId={dialog.promptId} />
    case 'import':
      return <ImportDialog />
    case 'export':
      return <ExportDialog ids={dialog.ids} />
    case 'shortcuts':
      return <ShortcutsDialog />
  }
}
