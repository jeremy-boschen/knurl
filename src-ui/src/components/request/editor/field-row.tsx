import React, { type ReactNode } from "react"

import { EllipsisIcon, ChevronUpIcon, ChevronDownIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/knurl/input"
import { cn } from "@/lib"

export type FieldRowProps = {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  nameValue: string
  onNameChange: (name: string) => void
  valueSlot?: ReactNode
  valueInputProps?: React.ComponentProps<typeof Input>
  onDelete: () => void
  secure?: boolean
  onSecureChange?: (secure: boolean) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  hasUnsavedEnabled?: boolean
  hasUnsavedName?: boolean
  hasUnsavedSecure?: boolean
}

function FieldRowComponent({
  enabled,
  onEnabledChange,
  nameValue,
  onNameChange,
  valueSlot,
  valueInputProps,
  onDelete,
  secure,
  onSecureChange,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  hasUnsavedEnabled = false,
  hasUnsavedName = false,
  hasUnsavedSecure = false,
}: FieldRowProps) {
  const hasMenuActions = onSecureChange || onMoveUp || onMoveDown

  return (
    <div
      className="grid grid-cols-[1.5rem_minmax(0,6fr)_minmax(0,8fr)_2rem] items-center gap-3 py-1 first:pt-0"
      data-test-id="field-row"
    >
      <div className="flex h-9 items-center">
        <Checkbox
          checked={enabled}
          className={cn(hasUnsavedEnabled && "unsaved-changes")}
          onCheckedChange={(checked) => onEnabledChange(!!checked)}
          data-test-id="field-row:enabled-checkbox"
        />
      </div>
      <div>
        <Input
          type="text"
          placeholder="Name"
          value={nameValue}
          onChange={(e) => onNameChange(e.target.value)}
          className={cn("font-mono", hasUnsavedName && "unsaved-changes")}
          data-test-id="field-row:name-input"
        />
      </div>
      <div className="min-w-0">{valueInputProps ? <Input {...valueInputProps} /> : valueSlot}</div>
      <div className="flex justify-center">
        {hasMenuActions ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 p-0" data-test-id="field-row:menu-button">
                <EllipsisIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {onSecureChange && (
                <>
                  <DropdownMenuCheckboxItem
                    checked={secure}
                    onCheckedChange={onSecureChange}
                    className={cn(hasUnsavedSecure && "unsaved-changes")}
                    data-test-id="field-row:menu-sensitive"
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
                    data-test-id="field-row:menu-move-up"
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
                    data-test-id="field-row:menu-move-down"
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
                data-test-id="field-row:menu-delete"
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
