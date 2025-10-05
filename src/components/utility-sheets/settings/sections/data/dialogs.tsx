import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react"
import * as React from "react"

import { getDataEncryptionKey, setDataEncryptionKey } from "@/bindings/knurl"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Button } from "@/components/ui/button"
import { CopyToClipboard } from "@/components/ui/knurl/copy"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/knurl/dialog"
import { Input } from "@/components/ui/knurl/input"
import { Textarea } from "@/components/ui/textarea"
import { useApplication } from "@/state"

type ExportKeyDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExportKeyDialog({ open, onOpenChange }: ExportKeyDialogProps) {
  const [{ currentKey, isLoading, error }, setState] = React.useState({
    currentKey: "",
    isLoading: false,
    error: null as string | null,
  })

  React.useEffect(() => {
    if (!open) {
      return
    }
    setState((s) => ({ ...s, isLoading: true, error: null, copied: false }))
    getDataEncryptionKey()
      .then((key) => setState((s) => ({ ...s, currentKey: String(key ?? ""), error: null })))
      .catch((e) => setState((s) => ({ ...s, error: `Failed to retrieve key: ${e}`, currentKey: "" })))
      .finally(() => setState((s) => ({ ...s, isLoading: false })))
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-[412px]">
        <DialogHeader>
          <DialogTitle>Export Encryption Key</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Alert className="border-amber-500/50 [&>svg]:text-amber-500">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Caution</AlertTitle>
          <AlertDescription>
            This is your encryption key. Losing this key may result in loss of access to some of your data.
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Input type="password" value={currentKey} readOnly disabled={isLoading} className="flex-1 font-mono" />

          <CopyToClipboard content={currentKey} disabled={isLoading || !currentKey} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------- ImportKeyDialog ----------

type ImportKeyDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportKeyDialog({ open, onOpenChange }: ImportKeyDialogProps) {
  const [{ newKeyInput, isLoading, error, confirmOpen, success }, setState] = React.useState({
    newKeyInput: "",
    isLoading: false,
    error: null as string | null,
    confirmOpen: false,
    success: false,
  })

  React.useEffect(() => {
    if (!open) {
      return
    }
    setState((s) => ({ ...s, newKeyInput: "", error: null, success: false, confirmOpen: false }))
  }, [open])

  const doImport = async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }))
    try {
      await setDataEncryptionKey(newKeyInput)

      // Warm collections then persist
      const collectionsIndex = useApplication.getState().collectionsState.index
      const collectionsApi = useApplication.getState().collectionsApi
      for (const collectionMeta of collectionsIndex) {
        await collectionsApi().getCollection(collectionMeta.id)
      }
      await useApplication.save()

      setState((s) => ({ ...s, success: true }))
      // Close after brief success flash
      window.setTimeout(() => onOpenChange(false), 900)
    } catch (e: unknown) {
      setState((s) => ({
        ...s,
        error: `Error importing key: ${e instanceof Error ? e.message : String(e)}`,
      }))
    } finally {
      setState((s) => ({ ...s, isLoading: false, confirmOpen: false }))
    }
  }

  const startImport = () => {
    if (!newKeyInput.trim()) {
      setState((s) => ({ ...s, error: "Please paste an encryption key." }))
      return
    }
    setState((s) => ({ ...s, confirmOpen: true }))
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Encryption Key</DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && !error && (
            <Alert>
              <CheckCircle2Icon className="h-4 w-4" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>Encryption key imported successfully.</AlertDescription>
            </Alert>
          )}

          <Alert className="border-amber-500/50 [&>svg]:text-amber-500">
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertTitle>Caution</AlertTitle>
            <AlertDescription>
              Importing a new key will re-encrypt all your data. This action is irreversible and may lead to data loss
              if the key is incorrect or lost.
            </AlertDescription>
          </Alert>

          <Textarea
            placeholder="Paste your encryption key here…"
            value={newKeyInput}
            onChange={(e) => setState((s) => ({ ...s, newKeyInput: e.target.value }))}
            disabled={isLoading}
            rows={3}
            className="font-mono"
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={startImport} disabled={isLoading || !newKeyInput.trim()}>
              Confirm Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation (shadcn AlertDialog, not native) */}
      <AlertDialog open={confirmOpen} onOpenChange={(v) => setState((s) => ({ ...s, confirmOpen: v }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Key Import</AlertDialogTitle>
            <AlertDialogDescription>
              Importing a new encryption key will re-encrypt all your data. This cannot be undone. Are you sure you want
              to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doImport} disabled={isLoading}>
              Yes, import key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
