import { useState } from "react"

import { useCollections } from "@/state"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type SaveRequestDialogProps = {
  open: boolean
  onConfirm: (context: { collectionId: string; folderId?: string }) => void | Promise<void>
  onCancel: () => void
}

export function SaveRequestDialog({ open, onConfirm, onCancel }: SaveRequestDialogProps) {
  const {
    state: { collectionsIndex },
  } = useCollections()
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("")

  const handleConfirm = async () => {
    if (selectedCollectionId) {
      await onConfirm({ collectionId: selectedCollectionId })
      setSelectedCollectionId("")
      onCancel()
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedCollectionId("")
      onCancel()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Request</DialogTitle>
          <DialogDescription>Select a collection to save this request to</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={selectedCollectionId} onValueChange={setSelectedCollectionId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a collection" />
            </SelectTrigger>
            <SelectContent>
              {collectionsIndex.map((collection) => (
                <SelectItem key={collection.id} value={collection.id}>
                  {collection.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedCollectionId}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
