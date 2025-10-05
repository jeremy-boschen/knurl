import { useCallback, useRef, useState } from "react"

import {
  DatabaseIcon,
  DownloadIcon,
  MonitorCogIcon,
  MoonIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
  XIcon,
} from "lucide-react"

import { NewCollectionDialog } from "@/components/collection/new-collection-dialog"
import { KnurlIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/knurl"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/knurl/tooltip"
import { useSidebar, useTheme, utilitySheetsApi } from "@/state"
import { CollectionTree } from "./collection-tree"

type DialogProps = { action: "new" }

function ModeToggle() {
  const {
    state: { theme },
    actions: { setTheme },
  } = useTheme()

  const handleThemeChange = useCallback(() => {
    switch (theme) {
      case "light":
        setTheme("dark")
        break
      case "dark":
        setTheme("light")
        break
      default:
        setTheme("light")
        break
    }
  }, [theme, setTheme])

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-primary hover:text-primary"
          onClick={handleThemeChange}
        >
          <SunIcon className="h-[1.2rem] w-[1.2rem] scale-0 data-[theme=light]:scale-100" data-theme={theme} />
          <MoonIcon className="absolute h-[1.2rem] w-[1.2rem] scale-0 data-[theme=dark]:scale-100" data-theme={theme} />
          <MonitorCogIcon
            className="absolute h-[1.2rem] w-[1.2rem] scale-0 data-[theme=system]:scale-100"
            data-theme={theme}
          />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Toggle Theme</p>
      </TooltipContent>
    </Tooltip>
  )
}

export default function Sidebar() {
  const {
    state: { isCollapsed },
    actions: { collapseSidebar, expandSidebar },
  } = useSidebar()
  const [searchTerm, setSearchTerm] = useState<string>("")
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
    <aside className="flex h-full w-full flex-col bg-background">
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
                    setSearchTerm("")
                    const el = searchRef.current
                    if (el) {
                      el.focus()
                    }
                  }
                }}
                className="w-full pl-6 text-sm"
                ref={searchRef}
                startAddon={<SearchIcon className="ml-1 h-4 w-4" />}
                endAddon={
                  searchTerm ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchTerm("")
                        const el = searchRef.current
                        if (el) {
                          el.focus()
                        }
                      }}
                      className="rounded-l-none"
                      aria-label="Clear search"
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
              >
                <PanelLeftOpenIcon className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Expand Sidebar</TooltipContent>
          </Tooltip>
        </header>
      )}

      <div className="flex-1 overflow-y-auto bg-sidebar">
        <CollectionTree searchTerm={searchTerm} />
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
