import React, { Profiler, useCallback, useOptimistic, useTransition } from "react"

import { ListIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/knurl/tooltip"
import { cn } from "@/lib"
import { onProfilerRender } from "@/lib/profiler-bridge"
import { useRequestHeaders } from "@/state"
import { FieldRow } from "./field-row"
import { EmptyState } from "./empty-state"

export type RequestHeadersPanelProps = {
  tabId: string
}

function RequestHeadersPanelComponent({ tabId }: RequestHeadersPanelProps) {
  const {
    state: { headers, original },
    actions,
  } = useRequestHeaders(tabId)

  const [, startTransition] = useTransition()

  const [optimisticHeaders, updateOptimisticHeader] = useOptimistic(
    headers,
    (state, { headerId, changes }: { headerId: string; changes: Record<string, unknown> }) => ({
      ...state,
      [headerId]: { ...state[headerId], ...changes },
    }),
  )

  const handleHeaderChange = useCallback(
    (headerId: string, changes: Record<string, unknown>) => {
      startTransition(() => {
        updateOptimisticHeader({ headerId, changes })
      })
      actions.updateHeader(headerId, changes)
    },
    [actions, updateOptimisticHeader],
  )

  const handleHeaderMoveUp = useCallback(
    (headerId: string) => {
      const ids = Object.keys(optimisticHeaders ?? {})
      const index = ids.indexOf(headerId)
      if (index > 0) {
        const newIds = [...ids]
        ;[newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]]
        actions.reorderHeaders(newIds)
      }
    },
    [optimisticHeaders, actions],
  )

  const handleHeaderMoveDown = useCallback(
    (headerId: string) => {
      const ids = Object.keys(optimisticHeaders ?? {})
      const index = ids.indexOf(headerId)
      if (index < ids.length - 1) {
        const newIds = [...ids]
        ;[newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]]
        actions.reorderHeaders(newIds)
      }
    },
    [optimisticHeaders, actions],
  )

  return (
    <Profiler id="RequestHeadersPanel" onRender={onProfilerRender}>
      <div className="flex flex-col gap-3 p-2 h-full overflow-y-auto min-h-0" data-test-id="request-headers-panel">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Request Headers</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => actions.addHeader()}
                data-test-id="request-headers-panel:add-header-button"
                className="h-6 px-2 gap-1"
              >
                <span className="text-xs">Add</span>
                <ListIcon className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add Header</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex flex-col gap-1 divide-y divide-border/10">
          {Object.entries(optimisticHeaders ?? {}).map(([_index, header]) => {
            const headerIds = Object.keys(optimisticHeaders ?? {})
            const headerIndex = headerIds.indexOf(header.id)
            return (
              <FieldRow
                key={header.id}
                id={header.id}
                dataTestPrefix="request-headers-panel"
                rowSuffix="header-row"
                enabled={header.enabled}
                onEnabledChange={(enabled) => handleHeaderChange(header.id, { enabled })}
                nameValue={header.name}
                onNameChange={(name) => handleHeaderChange(header.id, { name })}
                valueInputProps={{
                  type: header.secure ? "password" : "text",
                  placeholder: "Value",
                  value: header.value,
                  onChange: (e) => handleHeaderChange(header.id, { value: e.target.value }),
                  className: cn("font-mono", original[header.id]?.value !== header.value && "unsaved-changes"),
                }}
                secure={header.secure}
                onSecureChange={(secure) => handleHeaderChange(header.id, { secure })}
                onDelete={() => actions.removeHeader(header.id)}
                onMoveUp={() => handleHeaderMoveUp(header.id)}
                onMoveDown={() => handleHeaderMoveDown(header.id)}
                canMoveUp={headerIndex > 0}
                canMoveDown={headerIndex < headerIds.length - 1}
                hasUnsavedEnabled={original[header.id]?.enabled !== header.enabled}
                hasUnsavedName={original[header.id]?.name !== header.name}
                hasUnsavedSecure={original[header.id]?.secure !== header.secure}
              />
            )
          })}

          {Object.keys(headers ?? {}).length === 0 && (
            <EmptyState message='No headers added yet. Click "Add Header" to get started.' />
          )}
        </div>
      </div>
    </Profiler>
  )
}

export const RequestHeadersPanel = React.memo(RequestHeadersPanelComponent)
