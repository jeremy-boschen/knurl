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

export type CreateCollectionDialogProps = {
  open: boolean
  onConfirm: (context: { name: string }) => void | Promise<void>
  onCancel: () => void
}

export function CreateCollectionDialog({ open, onConfirm, onCancel }: CreateCollectionDialogProps) {
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Collection</DialogTitle>
          <DialogDescription>Enter the name for your new collection</DialogDescription>
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
            placeholder="Collection name"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!name.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
