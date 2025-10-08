import { ChevronDownIcon, ClipboardPasteIcon, UploadIcon } from "lucide-react"
import type { ImportFormat } from "../types"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LabeledField } from "@/components/ui/knurl"
import { Switch } from "@/components/ui/switch"

interface ImportSourceStepProps {
  importFormat: ImportFormat
  detectedFormat: "native" | "openapi" | "postman" | null
  onChooseFile: () => void
  onPaste: () => void
  onFormatChange: (format: ImportFormat) => void
  showOpenApiOptions?: boolean
  groupByTags?: boolean
  onGroupByTagsChange?: (group: boolean) => void
}

const ImportFormatName: { [K in ImportFormat]: string } = {
  auto: "Auto-Detect",
  native: "Native Knurl",
  openapi: "OpenAPI v3+",
  postman: "Postman Collection v2.1",
}

export function ImportSourceStep({
  importFormat,
  detectedFormat,
  onChooseFile,
  onPaste,
  onFormatChange,
  showOpenApiOptions = false,
  groupByTags = true,
  onGroupByTagsChange,
}: ImportSourceStepProps) {
  return (
    <div className="row-start-2 flex items-center justify-start pb-3 gap-4 flex-wrap">
      <LabeledField label="Data Source">
        <div className="flex gap-2">
          <Button variant="outline" onClick={onChooseFile}>
            <UploadIcon className="h-4 w-4 mr-2" />
            Choose File
          </Button>
          <Button variant="outline" onClick={onPaste}>
            <ClipboardPasteIcon className="h-4 w-4 mr-2" />
            Paste from Clipboard
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="default" variant="outline">
                <span className="sr-only">Choose import format</span>
                <ChevronDownIcon className="h-4 w-4" /> Import Type
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={4} className="min-w-[200px]">
              <DropdownMenuRadioGroup
                value={importFormat}
                onValueChange={(value) => onFormatChange(value as ImportFormat)}
              >
                {Object.entries(ImportFormatName).map(([format, name]) => (
                  <DropdownMenuRadioItem key={format} value={format}>
                    {name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </LabeledField>
      {showOpenApiOptions ? (
        <LabeledField label="Group by tags" placement="after">
          <div className="flex items-center gap-2">
            <Switch
              checked={groupByTags}
              onCheckedChange={(checked) => onGroupByTagsChange?.(checked)}
              aria-label="Group requests by first OpenAPI tag"
            />
            <span className="text-xs text-muted-foreground">Use the first OpenAPI tag as a folder.</span>
          </div>
        </LabeledField>
      ) : null}
      {detectedFormat && (
        <p className="text-xs text-muted-foreground">
          Detected: <span className="font-semibold">{detectedFormat}</span>
        </p>
      )}
    </div>
  )
}
