import React, { type ReactNode } from "react"

import { EllipsisIcon, ChevronUpIcon, ChevronDownIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/knurl/input"
import { cn } from "@/lib"

type FieldState = {
  enabled: boolean
  name: string
  value?: string
  secure?: boolean
}

type FieldUnsaved = Partial<Record<keyof FieldState, boolean>>

export type FieldRowProps = {
  fieldKey: string
  dataTestIdPrefix: string
  field: FieldState
  unsaved?: FieldUnsaved
  valueSlot?: ReactNode
  onChange: (changes: Partial<FieldState>) => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
}

function FieldRowComponent({
  fieldKey,
  dataTestIdPrefix,
  field,
  unsaved,
  valueSlot,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
}: FieldRowProps) {
  const showSecureToggle = typeof field.secure === "boolean"
  const hasMenuActions = showSecureToggle || onMoveUp || onMoveDown || onDelete
  const dt = (suffix: string) => `${dataTestIdPrefix}:${suffix}:${fieldKey}`

  return (
    <div
      className="grid grid-cols-[1.5rem_minmax(0,6fr)_minmax(0,8fr)_2rem] items-center gap-3 py-1 first:pt-0"
      data-test-id={dt("row")}
    >
      <div className="flex h-9 items-center">
        <Checkbox
          checked={field.enabled}
          className={cn(unsaved?.enabled && "unsaved-changes")}
          onCheckedChange={(checked) => onChange({ enabled: !!checked })}
          id={`${fieldKey}-enabled`}
          data-test-id={dt("enabled")}
        />
      </div>
      <div>
        <Input
          type="text"
          placeholder="Name"
          value={field.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className={cn("font-mono", unsaved?.name && "unsaved-changes")}
          id={`${fieldKey}-name`}
          data-test-id={dt("name")}
        />
      </div>
      {valueSlot ? (
        <div className="min-w-0" data-test-id={dt("value")}>
          {valueSlot}
        </div>
      ) : (
        <div className="min-w-0">
          <Input
            type={field.secure ? "password" : "text"}
            placeholder="Value"
            value={field.value ?? ""}
            onChange={(e) => onChange({ value: e.target.value })}
            className={cn("font-mono", unsaved?.value && "unsaved-changes")}
            id={`${fieldKey}-value`}
            data-test-id={dt("value")}
          />
        </div>
      )}
      <div className="flex justify-center">
        {hasMenuActions ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 p-0"
                id={`${fieldKey}-menu`}
                data-test-id={dt("menu-button")}
              >
                <EllipsisIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {showSecureToggle && (
                <>
                  <DropdownMenuCheckboxItem
                    checked={!!field.secure}
                    onCheckedChange={(checked) => onChange({ secure: !!checked })}
                    className={cn(unsaved?.secure && "unsaved-changes")}
                    data-test-id={dt("menu-sensitive")}
                  >
                    Sensitive
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {(onMoveUp || onMoveDown) && (
                <>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault()
                      onMoveUp?.()
                    }}
                    disabled={!canMoveUp}
                    data-test-id={dt("menu-move-up")}
                  >
                    <ChevronUpIcon className="mr-2 h-4 w-4" />
                    Move Up
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault()
                      onMoveDown?.()
                    }}
                    disabled={!canMoveDown}
                    data-test-id={dt("menu-move-down")}
                  >
                    <ChevronDownIcon className="mr-2 h-4 w-4" />
                    Move Down
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault()
                  onDelete()
                }}
                className="text-destructive focus:text-destructive"
                data-test-id={dt("menu-delete")}
              >
                <Trash2Icon className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="w-8" />
        )}
      </div>
    </div>
  )
}

export const FieldRow = React.memo(FieldRowComponent)
