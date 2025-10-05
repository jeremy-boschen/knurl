import type * as React from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

interface DeleteDialogProps<Context> {
  open: boolean
  title: string
  description: string | React.ReactNode
  context: Context
  onDelete: (context: Context) => Promise<void> | void
  onCancel: (context: Context) => void
}

export default function DeleteDialog<Context>({
  open,
  title,
  description,
  context,
  onDelete,
  onCancel,
}: DeleteDialogProps<Context>) {
  const handleSubmit = async () => {
    await onDelete(context)
    onCancel(context)
  }

  const handleOnOpenChange = (open: boolean) => {
    if (!open) {
      onCancel(context)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOnOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="ghost" size="sm">
              No
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" size="sm" onClick={handleSubmit}>
              Yes
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
