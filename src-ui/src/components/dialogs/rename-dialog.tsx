import { useState } from "react"

import type { RenameContext } from "@/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type RenameDialogProps = {
  open: boolean
  title: string
  description: React.ReactNode
  name: string
  onConfirm: (context: RenameContext, newName: string) => void | Promise<void>
  onCancel: () => void
  context: RenameContext
}

export function RenameDialog({
  open,
  title,
  description,
  name,
  onConfirm,
  onCancel,
  context,
}: RenameDialogProps) {
  const [newName, setNewName] = useState(name)

  const handleConfirm = async () => {
    if (newName.trim()) {
      await onConfirm(context, newName.trim())
      onCancel()
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setNewName(name)
      onCancel()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleConfirm()
              }
            }}
            placeholder="Enter new name"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!newName.trim() || newName === name}>
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
