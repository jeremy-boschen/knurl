import type React from "react"

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
} from "@/components/ui/dialog"
import { Form, FormControl } from "@/components/ui/knurl/form"
import { Input } from "@/components/ui/knurl/input"
import { Textarea } from "@/components/ui/textarea"
import { useCollections } from "@/state"

const schema = z.object({
  name: z.string().min(1, "Collection name is required").trim(),
  description: z.string().optional(),
})

export type NewCollectionDialogProps = {
  open: boolean
  onClose: () => Promise<void> | void
}

const InitialValues = {
  name: "",
  description: "",
}

export function NewCollectionDialog({ open, onClose }: NewCollectionDialogProps) {
  const {
    actions: { collectionsApi },
  } = useCollections()

  const handleSubmit = (data: z.infer<typeof schema>) => {
    collectionsApi().addCollection(data.name, data.description)
    onClose()
  }

  const handleOpenChange = (open: boolean | React.MouseEvent<HTMLButtonElement>) => {
    if (!open) {
      onClose()
    }
  }

  if (!open) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]" data-test-id="new-collection-dialog">
        <DialogHeader>
          <DialogTitle className="font-semibold leading-none text-lg tracking-tight">Create New Collection</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Create a new collection to organize your HTTP requests.
          </DialogDescription>
        </DialogHeader>

        <Form schema={schema} initialValues={InitialValues} onSubmit={handleSubmit} className="space-y-4">
          <FormControl name="name" label="Name">
            <Input
              name="name"
              placeholder="e.g., User API, Payment Service"
              autoFocus
              data-test-id="new-collection-dialog:name-input"
            />
          </FormControl>

          <FormControl name="description" label="Description">
            <Textarea
              name="description"
              placeholder="Optional description for this collection"
              rows={3}
              data-test-id="new-collection-dialog:description-input"
            />
          </FormControl>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="reset" variant="ghost" data-test-id="new-collection-dialog:cancel-button">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="default" data-test-id="new-collection-dialog:create-button">
              Create Collection
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
