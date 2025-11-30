import { useRef, useState } from "react"

import {
  DatabaseIcon,
  DownloadIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react"

import { NewCollectionDialog } from "@/components/collection/new-collection-dialog"
import { KnurlIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/knurl"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/knurl/tooltip"
import { useSidebar, utilitySheetsApi, useCollectionTree } from "@/state"
import { CollectionTree } from "./collection-tree"
import { CollectionTree2 } from "./collection-tree2"
import { ModeToggle } from "./mode-toggle"

type DialogProps = { action: "new" }

export default function Sidebar() {
  const {
    state: { isCollapsed },
    actions: { collapseSidebar, expandSidebar },
  } = useSidebar()
  const {
    state: { searchTerm },
    actions: { setSearchTerm, clearSearch },
  } = useCollectionTree()
  const searchRef = useRef<HTMLInputElement | null>(null)
  const [dialogProps, setDialogProps] = useState<DialogProps | null>(null)

  const sheetsApi = utilitySheetsApi()

  const openImportCollectionDialog = () => {
    sheetsApi.openSheet({ type: "import" })
  }

  const openSettingsDialog = () => {
    sheetsApi.openSheet({ type: "settings" })
  }

  const openNewCollectionDialog = async () => {
    expandSidebar()
    setDialogProps({ action: "new" })
  }

  return (
    <aside className="flex h-full w-full flex-col bg-background" data-test-id="sidebar">
      {/* Header */}
      {!isCollapsed ? (
        <>
          <header className="flex h-10 flex-row items-center justify-between p-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center">
                <KnurlIcon className="h-5 w-5" />
              </div>
              <h1 className="text-lg font-semibold text-primary">KNURL</h1>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={openImportCollectionDialog}
                    className="h-6 w-6 p-0 text-primary hover:text-primary"
                    data-test-id="sidebar:import-collection-button"
                  >
                    <DownloadIcon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Import Collection</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-primary hover:text-primary"
                    onClick={() => setDialogProps({ action: "new" })}
                    data-testid="sidebar-new-collection"
                    data-test-id="sidebar:new-collection-button"
                  >
                    <PlusIcon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New Collection</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-primary hover:text-primary"
                    onClick={openSettingsDialog}
                    data-test-id="sidebar:settings-button"
                  >
                    <SettingsIcon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Settings</TooltipContent>
              </Tooltip>
              <ModeToggle />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-primary hover:text-primary"
                    onClick={collapseSidebar}
                    data-test-id="sidebar:collapse-button"
                  >
                    <PanelLeftCloseIcon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Collapse Sidebar</TooltipContent>
              </Tooltip>
            </div>
          </header>
          <div className="flex flex-col p-2 bg-sidebar">
            {dialogProps?.action === "new" && <NewCollectionDialog open={true} onClose={() => setDialogProps(null)} />}
            {/* Collections Title */}
            <div className="mb-2 flex items-center">
              <div className="flex h-7 w-7 items-center justify-center">
                <DatabaseIcon className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold uppercase tracking-wide">Collections</h2>
            </div>

            {/* Search Bar */}
            <div className="px-2">
              <Input
                type="text"
                placeholder="Search requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && searchTerm) {
                    e.preventDefault()
                    e.stopPropagation()
                    clearSearch()
                    const el = searchRef.current
                    if (el) {
                      el.focus()
                    }
                  }
                }}
                className="w-full pl-6 text-sm"
                ref={searchRef}
                startAddon={<SearchIcon className="ml-1 h-4 w-4" />}
                data-test-id="sidebar:search-input"
                endAddon={
                  searchTerm ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        clearSearch()
                        const el = searchRef.current
                        if (el) {
                          el.focus()
                        }
                      }}
                      className="rounded-l-none"
                      aria-label="Clear search"
                      data-test-id="sidebar:clear-search-button"
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  ) : undefined
                }
              />
            </div>
          </div>
        </>
      ) : (
        <header className="flex flex-col items-center justify-center gap-3 p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-primary hover:text-primary"
                onClick={expandSidebar}
                data-test-id="sidebar:expand-button"
              >
                <PanelLeftOpenIcon className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Expand Sidebar</TooltipContent>
          </Tooltip>
        </header>
      )}

      <div className="flex-1 overflow-y-auto bg-sidebar">
        <CollectionTree />
      </div>

      <div className="flex-1 overflow-y-auto bg-sidebar">
        <CollectionTree2 />
      </div>

      {isCollapsed && (
        <footer className="flex flex-col items-center gap-3 p-2 pb-4 bg-sidebar">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-primary hover:text-primary"
                onClick={openNewCollectionDialog}
                data-testid="sidebar-new-collection"
                data-test-id="sidebar:new-collection-button-collapsed"
              >
                <PlusIcon className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New Collection</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={openImportCollectionDialog}
                className="h-6 w-6 p-0 text-primary hover:text-primary"
                data-test-id="sidebar:import-collection-button-collapsed"
              >
                <DownloadIcon className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Import Collection</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-primary hover:text-primary"
                onClick={openSettingsDialog}
                data-test-id="sidebar:settings-button-collapsed"
              >
                <SettingsIcon className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
          <ModeToggle />
        </footer>
      )}
    </aside>
  )
}
