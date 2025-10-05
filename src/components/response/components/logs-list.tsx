import React from "react"

import { CopyIcon, WrapTextIcon } from "lucide-react"

import { DataTable, DataTableCell, DataTableRow } from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { DEFAULT_LOG_LEVELS, type LogLevel } from "@/types"

const ALL_LEVELS = ["info", "debug", "warning", "error"] as const

const ENABLE_STRUCTURED_LOG_META = import.meta.env.VITE_ENABLE_STRUCTURED_LOG_META === "1"

type LogEntry = {
  timestamp: number | string
  level: LogLevel
  message: string
  infoType?: string | undefined
  category?: string
  phase?: string
  elapsedMs?: number
  details?: unknown
  bytesLogged?: number
  truncated?: boolean
}

const DEFAULT_LEVELS: LogLevel[] = [...DEFAULT_LOG_LEVELS]

const LOG_LEVEL_CSS = {
  info: "bg-log-info text-log-info-foreground",
  debug: "bg-log-debug text-log-debug-foreground",
  error: "bg-log-error text-log-error-foreground",
  warning: "bg-log-warning text-log-warning-foreground",
}

type LogsListProps = {
  logs: LogEntry[]
  sending?: boolean
  selectedLevels: LogLevel[]
  onSelectedLevelsChange?: (levels: LogLevel[]) => void
}

export const LogsList = ({ logs, sending, selectedLevels, onSelectedLevelsChange }: LogsListProps) => {
  const [selectedLevelSet, setSelectedLevelSet] = React.useState<Set<LogLevel>>(
    new Set(selectedLevels?.length ? selectedLevels : DEFAULT_LEVELS),
  )
  const [lineWrap, setLineWrap] = React.useState(true)

  React.useEffect(() => {
    const next = selectedLevels.length > 0 ? selectedLevels : DEFAULT_LEVELS
    setSelectedLevelSet(new Set(next))
  }, [selectedLevels])

  const updateSelection = React.useCallback(
    (next: Set<LogLevel>) => {
      const snapshot = Array.from(next)
      setSelectedLevelSet(new Set(snapshot))
      onSelectedLevelsChange?.(snapshot)
    },
    [onSelectedLevelsChange],
  )

  const allSelected = selectedLevelSet.size === ALL_LEVELS.length
  const someSelected = selectedLevelSet.size > 0 && !allSelected

  const getFilteredLogs = () => {
    if (!logs) {
      return [] as LogEntry[]
    }
    if (selectedLevelSet.size === ALL_LEVELS.length) {
      return logs
    }
    return logs.filter((log) => selectedLevelSet.has((log.level as LogLevel) ?? "info"))
  }

  const handleToggleAll = (checked: boolean | "indeterminate") => {
    if (checked === true) {
      updateSelection(new Set(ALL_LEVELS))
    } else {
      // Do not allow none selected; main off -> Info only
      updateSelection(new Set(DEFAULT_LEVELS))
    }
  }

  const handleToggleLevel = (level: LogLevel, checked: boolean | "indeterminate") => {
    const next = new Set(selectedLevelSet)
    const isChecked = checked === true
    if (isChecked) {
      next.add(level)
    } else if (next.has(level) && next.size > 1) {
      next.delete(level)
    }
    updateSelection(next)
  }

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text)
  }

  const buildMetaLabel = (log: LogEntry) => {
    const sections: string[] = []

    if (ENABLE_STRUCTURED_LOG_META) {
      if (log.category) {
        sections.push(log.category)
      }
      if (log.phase && log.phase !== log.category) {
        sections.push(log.phase)
      }
      // For structured logs, category/phase are preferred labels.
    }

    if (sections.length === 0 && log.infoType && !sections.includes(log.infoType)) {
      sections.push(log.infoType)
    }

    return sections.join(" / ")
  }

  const copyAllLogs = () => {
    const filtered = getFilteredLogs()
    const logText = filtered
      .map(
        (log) =>
          `[${new Date(log.timestamp).toISOString()}] ${log.level.toUpperCase()}${(() => {
            const meta = buildMetaLabel(log)
            return meta ? ` (${meta})` : ""
          })()}: ${log.message}`,
      )
      .join("\n")
    copyToClipboard(logText)
  }

  const formatLocalTimeWithMs = (value: number | string) => {
    const d = new Date(value)
    const base = d
      .toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .toString()
    const ms = d.getMilliseconds().toString().padStart(3, "0")
    return `${base}.${ms}`
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center py-4">
          <div className="text-center text-foreground">
            <div className="mb-2 text-4xl">📋</div>
            <div className="text-lg font-medium">{sending ? "Waiting for Logs" : "No Logs Available"}</div>
            <div className="text-sm">{sending ? "Request logs will appear here" : "Send a request to see logs"}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-background p-4">
        <div className="flex flex-wrap items-center gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <span className="mr-2">Levels</span>
                <span className="text-muted-foreground/75">
                  {(() => {
                    if (allSelected) {
                      return "All"
                    }
                    const items = Array.from(selectedLevelSet)
                    if (items.length <= 2) {
                      return items.map((l) => l.toUpperCase()).join(", ")
                    }
                    return `${items.length} selected`
                  })()}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={handleToggleAll}
                    aria-label="All levels"
                  />
                  <span className={cn("text-sm", !allSelected && "text-foreground/75")}>All</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {ALL_LEVELS.map((lvl) => (
                    <div key={lvl} className="flex items-center space-x-2">
                      <Checkbox
                        checked={selectedLevelSet.has(lvl)}
                        onCheckedChange={(v) => handleToggleLevel(lvl, v)}
                        aria-label={lvl}
                      />
                      <span className={cn("text-sm capitalize", !selectedLevelSet.has(lvl) && "text-foreground/75")}>
                        {lvl}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={lineWrap ? "secondary" : "outline"}
                  size="icon"
                  onClick={() => setLineWrap(!lineWrap)}
                  aria-pressed={lineWrap}
                  title="Toggle line wrapping"
                >
                  <WrapTextIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle line wrapping</p>
              </TooltipContent>
            </Tooltip>
            <span className="text-xs">
              {getFilteredLogs().length} of {logs.length} logs
            </span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={copyAllLogs} disabled={getFilteredLogs().length === 0}>
          <CopyIcon className="mr-1 h-4 w-4" />
          Copy Logs
        </Button>
      </div>
      <div className="flex-1 overflow-auto font-mono text-sm">
        <DataTable columnTemplate="auto auto 1fr auto">
          {getFilteredLogs().map((log, index) => {
            const metaLabel = buildMetaLabel(log)
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: index is stable
              <DataTableRow key={index} className="group/log-entry">
                <DataTableCell
                  type="cell"
                  className="py-1 pr-3 text-xs text-muted-foreground whitespace-nowrap"
                  title={new Date(log.timestamp).toISOString()}
                >
                  {formatLocalTimeWithMs(log.timestamp)}
                </DataTableCell>
                <DataTableCell type="cell" className="py-1 pr-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
                      LOG_LEVEL_CSS[log.level],
                    )}
                  >
                    {log.level.toUpperCase()}
                  </span>
                </DataTableCell>
                <DataTableCell
                  type="cell"
                  className={cn("py-1 pr-3 min-w-0", lineWrap ? "break-all" : "whitespace-pre-wrap")}
                >
                  {ENABLE_STRUCTURED_LOG_META && metaLabel && (
                    <span className="mr-2 text-[10px] uppercase tracking-wide text-muted-foreground/80">
                      {metaLabel}
                    </span>
                  )}
                  <span>{log.message}</span>
                </DataTableCell>
                <DataTableCell type="cell" className="py-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover/log-entry:opacity-100"
                    onClick={() => copyToClipboard(log.message)}
                  >
                    <CopyIcon className="h-3 w-3" />
                  </Button>
                </DataTableCell>
              </DataTableRow>
            )
          })}
        </DataTable>
      </div>
    </div>
  )
}
