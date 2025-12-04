import { useState } from "react"

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

export type CreateFolderDialogProps = {
  open: boolean
  onConfirm: (context: { name: string }) => void | Promise<void>
  onCancel: () => void
}

export function CreateFolderDialog({ open, onConfirm, onCancel }: CreateFolderDialogProps) {
  const [name, setName] = useState("")

  const handleConfirm = async () => {
    if (name.trim()) {
      await onConfirm({ name: name.trim() })
      setName("")
      onCancel()
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setName("")
      onCancel()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-test-id="create-folder-dialog">
        <DialogHeader>
          <DialogTitle>New Folder</DialogTitle>
          <DialogDescription>Enter the name for your new folder</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleConfirm()
              }
            }}
            placeholder="Folder name"
            data-test-id="create-folder-dialog:name-input"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} data-test-id="create-folder-dialog:cancel-button">
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!name.trim()} data-test-id="create-folder-dialog:confirm-button">
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
