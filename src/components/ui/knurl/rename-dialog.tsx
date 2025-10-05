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
} from "@/components/ui/knurl/dialog"
import { Form, FormControl } from "@/components/ui/knurl/form"
import { Input } from "@/components/ui/knurl/input"

interface RenameDialogProps<Context> {
  open: boolean
  title: string
  description: string | React.ReactNode
  name: string
  placeholder?: string
  context: Context
  onRename: (newName: string, context: Context) => Promise<void> | void
  onCancel: (context: Context) => void
  submitLabel?: string
}

const schema = z.object({
  name: z.string().min(1, "Name is required").trim(),
})

export default function RenameDialog<Context>({
  open,
  title,
  description,
  name,
  context,
  placeholder = "Enter new name...",
  onRename,
  onCancel,
  submitLabel = "Rename",
}: RenameDialogProps<Context>) {
  const handleSubmit = async (data: z.infer<typeof schema>) => {
    await onRename(data.name, context)
    onCancel(context)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onCancel(context)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      resizable
      size={{
        min: {
          width: 450,
          height: 240,
        },
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-semibold leading-none text-lg tracking-tight">{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">{description}</DialogDescription>
        </DialogHeader>

        <Form schema={schema} initialValues={{ name }} onSubmit={handleSubmit} className="space-y-4">
          <FormControl name="name" label="Name">
            <Input name="name" placeholder={placeholder} className="w-full" autoFocus />
          </FormControl>

          <DialogFooter className="flex space-x-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="default">
              {submitLabel}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
