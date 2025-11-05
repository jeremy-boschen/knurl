import React from "react"

import { Sheet, SheetContent } from "@/components/ui/sheet"
import CollectionSettingsSheet from "@/components/utility-sheets/collection-settings"
import ExportCollectionSheet from "@/components/utility-sheets/export-collection"
import ImportCollectionSheet from "@/components/utility-sheets/import-collection"
import SettingsSheet from "@/components/utility-sheets/settings"
import ThemeEditorSheet from "@/components/utility-sheets/theme-editor"
import { useUtilitySheets } from "@/state"
import type { UtilitySheet, UtilitySheetType } from "@/types"

// All utility sheets share the same responsive width, controlled by a CSS var.
// See src/index.css :root --utility-sheet-width (default 60vw)
const SHEET_CLASS_BY_TYPE: Record<UtilitySheetType, string> = {
  settings: "!w-[var(--utility-sheet-width)] !max-w-[100vw]",
  import: "!w-[var(--utility-sheet-width)] !max-w-[100vw]",
  export: "!w-[var(--utility-sheet-width)] !max-w-[100vw]",
  environment: "!w-[var(--utility-sheet-width)] !max-w-[100vw]",
  "collection-settings": "!w-[var(--utility-sheet-width)] !max-w-[100vw]",
  "theme-editor": "!w-[var(--utility-sheet-width)] !max-w-[100vw]",
}

export function UtilitySheetHost() {
  const {
    state: { activeSheet },
    actions: { utilitySheetsApi },
  } = useUtilitySheets()

  const [renderedSheet, setRenderedSheet] = React.useState<UtilitySheet | null>(null)
  const [isOpen, setIsOpen] = React.useState(false)
  const closeTimer = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (activeSheet) {
      if (closeTimer.current) {
        window.clearTimeout(closeTimer.current)
        closeTimer.current = null
      }
      setRenderedSheet(activeSheet)
      requestAnimationFrame(() => setIsOpen(true))
    } else if (renderedSheet) {
      setIsOpen(false)
      closeTimer.current = window.setTimeout(() => {
        setRenderedSheet(null)
        closeTimer.current = null
      }, 350)
    } else {
      setIsOpen(false)
    }
  }, [activeSheet, renderedSheet])

  React.useEffect(
    () => () => {
      if (closeTimer.current) {
        window.clearTimeout(closeTimer.current)
      }
    },
    [],
  )

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        utilitySheetsApi.closeSheet()
      }
    },
    [utilitySheetsApi],
  )

  if (!renderedSheet) {
    return null
  }

  let content: React.ReactNode = null

  switch (renderedSheet.type) {
    case "settings":
      content = <SettingsSheet />
      break
    case "import":
      content = <ImportCollectionSheet />
      break
    case "export":
      if (renderedSheet.context) {
        content = <ExportCollectionSheet collectionId={renderedSheet.context.collectionId} />
      }
      break
    case "environment":
      if (renderedSheet.context) {
        // Alias legacy environment sheet to the new tabbed collection-settings sheet
        content = (
          <CollectionSettingsSheet
            collectionId={renderedSheet.context.collectionId}
            selectedEnvironmentId={renderedSheet.context.selectedEnvironmentId}
            tab="environments"
          />
        )
      }
      break
    case "collection-settings":
      if (renderedSheet.context) {
        content = (
          <CollectionSettingsSheet
            collectionId={renderedSheet.context.collectionId}
            selectedEnvironmentId={renderedSheet.context.selectedEnvironmentId}
            tab={renderedSheet.context.tab}
          />
        )
      }
      break
    case "theme-editor":
      content = <ThemeEditorSheet />
      break
    default:
      content = null
  }

  if (!content) {
    return null
  }

  const widthClass = SHEET_CLASS_BY_TYPE[renderedSheet.type]
  const sheetKey = renderedSheet.id

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent
        key={sheetKey}
        side="right"
        forceMount
        data-kind="utility-sheet"
        className={`${widthClass} h-full !max-w-[100vw] border-l bg-background p-0`}
      >
        {content}
      </SheetContent>
    </Sheet>
  )
}
