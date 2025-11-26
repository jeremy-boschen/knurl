import { openPath } from "@tauri-apps/plugin-opener"
import { SquareArrowOutUpRightIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/knurl/input"
import { Separator } from "@/components/ui/separator"
import { useSettings } from "@/state"
import { SettingRow } from "../setting-row"
import { ExportKeyDialog, ImportKeyDialog } from "./dialogs"

type DialogProps = {
  action: "import" | "export"
  open: boolean
}

export default function DataSection() {
  const {
    state: settingsState,
    actions: { settingsApi },
  } = useSettings()
  const [dialogProps, setDialogProps] = useState<DialogProps | null>(null)

  const showExportEncryptionKeyDialog = async () => {
    setDialogProps({
      action: "export",
      open: true,
    })
  }

  const showImportEncryptionKeyDialog = async () => {
    setDialogProps({
      action: "import",
      open: true,
    })
  }

  const handleDialogOpenChange = (open?: boolean) => {
    if (!open) {
      setDialogProps(null)
    }
  }

  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-6 p-1">
        <SettingRow
          label="Auto-save interval"
          description={
            <span>
              Seconds between auto-saving application data. A value of <u>0</u> will disable this feature.
            </span>
          }
        >
          <Input
            type="number"
            min="0"
            className="w-24"
            value={String(settingsState.requests.autoSave)}
            onChange={(e) => settingsApi().setAutoSaveRequests(Number(e.target.value) || 0)}
            data-test-id="settings-data:auto-save-input"
          />
        </SettingRow>
        <Separator className="mt-4 mb-4" />
        <SettingRow
          label="Encryption Key"
          description="Export or import your encryption key. Be careful, this is sensitive data."
          className="flex flex-col items-stretch gap-2"
        >
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-gray-600"
              onClick={showExportEncryptionKeyDialog}
              data-test-id="settings-data:export-key-button"
            >
              Export Key
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-gray-600"
              onClick={showImportEncryptionKeyDialog}
              data-test-id="settings-data:import-key-button"
            >
              Import Key
            </Button>
          </div>
        </SettingRow>
        <Separator className="mt-4 mb-4" />
        <SettingRow
          label="Storage Location"
          description="Location of Knurl application data files"
          className="flex flex-col items-stretch gap-2"
        >
          <div className="flex gap-2">
            <Input
              type="text"
              readOnly
              className="flex-1"
              value={settingsState.data.appDataDir}
              endAddon={
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Open storage location"
                  title="Open storage location"
                  onClick={() => openPath(settingsState.data.appDataDir)}
                  data-test-id="settings-data:open-path-button"
                >
                  <SquareArrowOutUpRightIcon className="w-4 h-4" />
                </Button>
              }
              data-test-id="settings-data:storage-path-input"
            />
          </div>
        </SettingRow>
      </div>
      {dialogProps?.action === "import" && <ImportKeyDialog open={true} onOpenChange={handleDialogOpenChange} />}
      {dialogProps?.action === "export" && <ExportKeyDialog open={true} onOpenChange={handleDialogOpenChange} />}
    </>
  )
}
