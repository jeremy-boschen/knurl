import { useCallback, useEffect, useRef, useState } from "react"

import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsUpDownIcon, RefreshCwIcon } from "lucide-react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Input } from "@/components/ui/knurl/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib"
import { useSettings } from "@/state"
import { zCustomTheme } from "@/types"

const THEME_REGISTRY_URL = "https://tweakcn.com/r/themes/registry.json"

const isAbortError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "name" in error && (error as { name?: string }).name === "AbortError"

const zThemeRegistryItem = z
  .object({
    type: z.literal("registry:style"),
    name: z.string(),
    title: z.string(),
    ...zCustomTheme.shape,
  })
  .catchall(z.any())

const zThemeRegistry = z.object({
  items: z.array(z.any()),
})

type ThemeRegistryItem = z.infer<typeof zThemeRegistryItem>

interface ThemeSelectorProps {
  onThemeSelect: (theme: ThemeRegistryItem) => void
  disabled?: boolean
}

export function ThemeSelector({ onThemeSelect, disabled = false }: ThemeSelectorProps) {
  const {
    state: settingsState,
    actions: { settingsApi },
  } = useSettings()
  const [open, setOpen] = useState(false)
  const [themes, setThemes] = useState<ThemeRegistryItem[]>([])
  const [status, setStatus] = useState<{ pending?: boolean; error?: Error }>({})
  const [registryUrl, setRegistryUrl] = useState(settingsState.appearance.themeRegistryUrl || THEME_REGISTRY_URL)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (disabled) {
      setOpen(false)
    }
  }, [disabled])

  useEffect(() => {
    setRegistryUrl(settingsState.appearance.themeRegistryUrl || THEME_REGISTRY_URL)
  }, [settingsState.appearance.themeRegistryUrl])

  const isPresetSource = settingsState.appearance.themeSource === "preset"
  const canFetch = !disabled && isPresetSource

  const fetchRegistry = useCallback(async () => {
    if (!canFetch) {
      return
    }

    const url = registryUrl.trim()
    if (!url) {
      return
    }
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setStatus({ pending: true })
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.statusText}`)
      }
      const data = await res.json()
      const parsed = zThemeRegistry.safeParse(data)
      if (!parsed.success) {
        throw new Error("Failed to parse theme registry.")
      }

      const themeItems = parsed.data.items
        .map((item) => zThemeRegistryItem.safeParse(item))
        .filter((p): p is { success: true; data: ThemeRegistryItem } => p.success)
        .map((p) => p.data)

      setThemes(themeItems)
      setStatus({ pending: false })
      settingsApi().setThemeRegistryUrl(url === THEME_REGISTRY_URL ? "" : url)
    } catch (error) {
      if (isAbortError(error)) {
        return
      }
      console.error("Failed to fetch theme registry:", error)
      setStatus({ pending: false, error: error as Error })
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null
        setStatus((prev) => (prev.pending ? { ...prev, pending: false } : prev))
      }
    }
  }, [canFetch, registryUrl, settingsApi])

  useEffect(() => {
    if (!canFetch) {
      return undefined
    }
    void fetchRegistry()
    return () => {
      controllerRef.current?.abort()
    }
  }, [canFetch, fetchRegistry])

  useEffect(() => {
    if (!canFetch) {
      controllerRef.current?.abort()
      setStatus((prev) => (prev.pending || prev.error ? { ...prev, pending: false } : prev))
    }
  }, [canFetch])

  useEffect(() => {
    return () => {
      controllerRef.current?.abort()
    }
  }, [])

  const handleSelect = (themeName: string) => {
    if (disabled) {
      return
    }
    const theme = themes.find((t) => t.name === themeName)
    if (theme) {
      onThemeSelect(theme)
    }
    setOpen(false)
  }

  const handleCycle = (direction: "next" | "prev") => {
    if (disabled) {
      return
    }
    if (themes.length === 0) {
      return
    }
    const currentIndex = themes.findIndex((t) => t.name === settingsState.appearance.selectedPresetTheme)

    let nextIndex: number
    if (direction === "next") {
      nextIndex = currentIndex >= themes.length - 1 ? 0 : currentIndex + 1
    } else {
      nextIndex = currentIndex <= 0 ? themes.length - 1 : currentIndex - 1
    }

    const nextTheme = themes[nextIndex]
    if (nextTheme) {
      onThemeSelect(nextTheme)
    }
  }

  const handleUrlBlur = () => {
    if (registryUrl.trim() === "") {
      setRegistryUrl(THEME_REGISTRY_URL)
    }
  }

  const selectedTheme = themes.find((t) => t.name === settingsState.appearance.selectedPresetTheme)

  return (
    <div
      className={cn("flex items-center gap-2 w-full", disabled && "opacity-60")}
      aria-disabled={disabled}
      data-disabled={disabled}
    >
      {/* Registry URL input moved out beside the combobox */}
      <Input
        placeholder="Theme registry URL"
        value={registryUrl}
        onChange={(e) => setRegistryUrl(e.target.value)}
        onBlur={handleUrlBlur}
        className="w-full"
        disabled={disabled}
        endAddon={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              if (!disabled) {
                void fetchRegistry()
              }
            }}
            disabled={status.pending || disabled}
            aria-label="Fetch themes from registry"
            title="Fetch themes from registry"
          >
            <RefreshCwIcon className={cn("h-4 w-4", status.pending && "animate-spin")} />
          </Button>
        }
      />
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (!disabled) {
            setOpen(next)
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-56 justify-between"
            disabled={disabled}
          >
            {selectedTheme ? selectedTheme.title : "Preset Themes"}
            <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[24rem] p-0" side="bottom">
          <Command>
            <CommandInput placeholder="Search themes..." />
            <CommandList className="max-h-[24svh]">
              <CommandEmpty>No themes found.</CommandEmpty>
              <CommandGroup>
                {themes.map((theme) => (
                  <CommandItem key={theme.name} value={theme.name} onSelect={() => handleSelect(theme.name)}>
                    <CheckIcon
                      className={cn("mr-2 h-4 w-4", selectedTheme?.name === theme.name ? "opacity-100" : "opacity-0")}
                    />
                    {theme.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            {/* Registry controls are now outside the popover */}
          </Command>
        </PopoverContent>
      </Popover>
      <div className="flex items-center gap-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-r-none"
          disabled={themes.length === 0 || disabled}
          onClick={() => handleCycle("prev")}
          aria-label="Previous theme"
          title="Previous theme"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-l-none"
          disabled={themes.length === 0 || disabled}
          onClick={() => handleCycle("next")}
          aria-label="Next theme"
          title="Next theme"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>
      {status.error && <p className="text-xs text-red-400 px-1">{status.error.message}</p>}
    </div>
  )
}
