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
import { Form, FormControl } from "@/components/ui/knurl/form"
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

  const handleSubmit = async (data: z.infer<typeof schema>) => {
    await onSave(data.collectionId, data.name)
    onClose()
  }

  // Set default name when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose()
    }
  }

  if (!open) {
    return null
  }

  // Omit the scratch collection
  const collections = collectionsIndex
    .filter((c) => c.id !== ScratchCollectionId)
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-semibold leading-none text-lg tracking-tight">Save Request</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Save your current request to a collection for later use.
          </DialogDescription>
        </DialogHeader>

        <Form
          schema={schema}
          onSubmit={handleSubmit}
          initialValues={{ name: request.name ?? "", collectionId: "" }}
          className="space-y-4"
        >
          <FormControl name="name" label="Name">
            <Input name="name" type="text" placeholder="e.g., Get User Profile, Create Order" autoFocus />
          </FormControl>

          <FormControl name="collectionId" label="Collection">
            {collections.length === 0 ? (
              <p className="text-sm text-destructive">No collections available. Create a collection first.</p>
            ) : (
              <Select name="collectionId">
                <SelectTrigger className="min-w-6/12">
                  <SelectValue placeholder="Select a collection" />
                </SelectTrigger>
                <SelectContent>
                  {collections.map((collection) => (
                    <SelectItem key={collection.id} value={collection.id}>
                      {collection.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormControl>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button type="submit" variant="default">
              Save Request
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
