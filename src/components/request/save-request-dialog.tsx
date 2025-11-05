import { useEffect, useId, useMemo, useState } from "react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/knurl/dialog"
import { Input } from "@/components/ui/knurl/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScratchCollectionId, useCollections } from "@/state"
import type { RequestState } from "@/types"

export type SaveRequestDialogProps = {
  open: boolean
  onSave: (collectionId: string, name: string) => Promise<void>
  onClose: () => void
  request: RequestState
}

const schema = z.object({
  name: z.string().min(1, "Request name is required").trim(),
  collectionId: z.string().min(1, "Collection is required").trim(),
})

export default function SaveRequestDialog({ open, onSave, onClose, request }: SaveRequestDialogProps) {
  const {
    state: { collectionsIndex },
  } = useCollections()

  const [name, setName] = useState("")
  const [collectionId, setCollectionId] = useState("")
  const [errors, setErrors] = useState<{ name?: string; collectionId?: string }>({})
  const nameInputId = useId()
  const collectionSelectId = useId()

  const collections = useMemo(
    () =>
      collectionsIndex
        .filter((c) => c.id !== ScratchCollectionId)
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [collectionsIndex],
  )

  useEffect(() => {
    if (open) {
      const nextName = request.name?.trim() ?? ""
      const preferredCollectionId =
        request.collectionId && request.collectionId !== ScratchCollectionId
          ? request.collectionId
          : collections.length === 1
            ? (collections[0]?.id ?? "")
            : ""

      setName(nextName)
      setCollectionId(preferredCollectionId)
      setErrors({})
    }
  }, [collections, open, request.collectionId, request.name])

  const handleSubmit = async () => {
    const result = schema.safeParse({ name: name.trim(), collectionId: collectionId.trim() })
    if (!result.success) {
      const nextErrors: { name?: string; collectionId?: string } = {}
      for (const issue of result.error.issues) {
        if (issue.path[0] === "name") {
          nextErrors.name = issue.message
        }
        if (issue.path[0] === "collectionId") {
          nextErrors.collectionId = issue.message
        }
      }
      setErrors(nextErrors)
      return
    }

    await onSave(result.data.collectionId, result.data.name)
    onClose()
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onClose()
    }
  }

  if (!open) {
    return null
  }

  const canSubmit = collections.length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-test-id="save-request-dialog">
        <DialogHeader>
          <DialogTitle className="font-semibold leading-none text-lg tracking-tight">Save Request</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Save your current request to a collection for later use.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-[8rem_1fr] items-start gap-4">
            <label className="text-right text-sm text-muted-foreground" htmlFor={nameInputId}>
              Name
            </label>
            <div className="space-y-2">
              <Input
                id={nameInputId}
                name="name"
                type="text"
                placeholder="e.g., Get User Profile, Create Order"
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.currentTarget.value)
                  setErrors((prev) => ({ ...prev, name: undefined }))
                }}
                data-test-id="save-request-dialog:name-input"
              />
              {errors.name && <p className="text-xs font-medium text-destructive">{errors.name}</p>}
            </div>
          </div>

          <div className="grid grid-cols-[8rem_1fr] items-start gap-4">
            <label className="text-right text-sm text-muted-foreground" htmlFor={collectionSelectId}>
              Collection
            </label>
            <div className="space-y-2">
              {collections.length === 0 ? (
                <p className="text-sm text-destructive">No collections available. Create a collection first.</p>
              ) : (
                <Select
                  value={collectionId || undefined}
                  name="collectionId"
                  onValueChange={(value) => {
                    setCollectionId(value)
                    setErrors((prev) => ({ ...prev, collectionId: undefined }))
                  }}
                >
                  <SelectTrigger
                    id={collectionSelectId}
                    className="min-w-6/12"
                    data-test-id="save-request-dialog:collection-select"
                  >
                    <SelectValue placeholder="Select a collection" />
                  </SelectTrigger>
                  <SelectContent>
                    {collections.map((collection) => (
                      <SelectItem
                        key={collection.id}
                        value={collection.id}
                        data-test-id={`save-request-dialog:collection-item:${collection.id}`}
                      >
                        {collection.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {errors.collectionId && <p className="text-xs font-medium text-destructive">{errors.collectionId}</p>}
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" data-test-id="save-request-dialog:cancel-button">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="default"
              onClick={handleSubmit}
              disabled={!canSubmit}
              data-test-id="save-request-dialog:save-button"
            >
              Save Request
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
