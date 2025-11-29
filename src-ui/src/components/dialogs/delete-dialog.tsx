import type { DeleteContext } from "@/types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export type DeleteDialogProps = {
  open: boolean
  title: string
  description: React.ReactNode
  onConfirm: (context: DeleteContext) => void | Promise<void>
  onCancel: () => void
  context: DeleteContext
}

export function DeleteDialog({ open, title, description, onConfirm, onCancel, context }: DeleteDialogProps) {
  const handleConfirm = async () => {
    await onConfirm(context)
    onCancel()
  }

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} variant="destructive">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
