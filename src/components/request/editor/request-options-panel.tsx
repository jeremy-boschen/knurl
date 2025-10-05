import { type ReactNode, useId, useState } from "react"

import { Input } from "@/components/ui/knurl/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib"
import { useRequestOptions, useSettings } from "@/state"
import { openFile } from "@/bindings/knurl"

export type RequestOptionsPanelProps = {
  tabId: string
}

type OptionFieldProps = {
  label: ReactNode
  children: (id: string) => ReactNode
  className?: string
}

function OptionField({ label, children, className }: OptionFieldProps) {
  const id = useId()
  return (
    <div className={cn("grid grid-cols-[8rem_1fr] items-center gap-4", className)}>
      <Label htmlFor={id} className="text-right text-sm text-muted-foreground">
        {label}
      </Label>
      <div className="min-w-0">{children(id)}</div>
    </div>
  )
}

export function RequestOptionsPanel({ tabId }: RequestOptionsPanelProps) {
  const {
    state: { options, original, autoSave, originalAutoSave },
    actions,
  } = useRequestOptions(tabId)
  const { state: settingsState } = useSettings()
  const [caBundleSource, setCaBundleSource] = useState<"path" | "text">("path")
  const caPathOptionId = useId()
  const caTextOptionId = useId()

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background p-4 text-sm">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <OptionField label="Auto Save">
            {(id) => (
              <Switch
                id={id}
                checked={!!autoSave}
                onCheckedChange={(checked) => actions.updateAutoSave(!!checked)}
                className={cn(originalAutoSave !== autoSave && "unsaved-changes")}
              />
            )}
          </OptionField>

          <OptionField label="Disable SSL">
            {(id) => (
              <Switch
                id={id}
                checked={options?.disableSsl ?? false}
                onCheckedChange={(checked) => actions.updateClientOption({ disableSsl: !!checked })}
                className={cn(original?.disableSsl !== options?.disableSsl && "unsaved-changes")}
              />
            )}
          </OptionField>

          <OptionField label="Timeout (s)">
            {(id) => (
              <Input
                id={id}
                type="number"
                min="1"
                placeholder={`${settingsState.requests.timeout}`}
                value={options?.timeoutSecs ?? ""}
                onChange={(e) =>
                  actions.updateClientOption({
                    timeoutSecs: e.target.value ? parseInt(e.target.value, 10) : undefined,
                  })
                }
                className={cn("w-24 font-mono", original?.timeoutSecs !== options?.timeoutSecs && "unsaved-changes")}
              />
            )}
          </OptionField>

          <OptionField label="Max Redirects">
            {(id) => (
              <Input
                id={id}
                type="number"
                min="0"
                placeholder="10"
                value={options?.maxRedirects ?? ""}
                onChange={(e) =>
                  actions.updateClientOption({
                    maxRedirects: e.target.value ? parseInt(e.target.value, 10) : undefined,
                  })
                }
                className={cn("w-24 font-mono", original?.maxRedirects !== options?.maxRedirects && "unsaved-changes")}
              />
            )}
          </OptionField>
        </div>

        <div className="space-y-6">
          <OptionField label="HTTP Version">
            {(id) => (
              <RadioGroup
                id={id}
                value={options?.httpVersion ?? "auto"}
                onValueChange={(value) =>
                  actions.updateClientOption({ httpVersion: value as "auto" | "http1" | "http2" })
                }
                className="flex items-center gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="auto" id={`${id}-auto`} />
                  <Label htmlFor={`${id}-auto`} className="cursor-pointer font-normal">
                    Auto
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="http1" id={`${id}-h1`} />
                  <Label htmlFor={`${id}-h1`} className="cursor-pointer font-normal">
                    HTTP/1.1
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="http2" id={`${id}-h2`} />
                  <Label htmlFor={`${id}-h2`} className="cursor-pointer font-normal">
                    HTTP/2
                  </Label>
                </div>
              </RadioGroup>
            )}
          </OptionField>

          <OptionField label="User Agent">
            {(id) => (
              <Input
                id={id}
                type="text"
                placeholder="Knurl/1.0.0"
                value={options?.userAgent ?? ""}
                onChange={(e) => actions.updateClientOption({ userAgent: e.target.value ?? "" })}
                className={cn("font-mono", original?.userAgent !== options?.userAgent && "unsaved-changes")}
              />
            )}
          </OptionField>

          <OptionField label="DNS Override">
            {(id) => (
              <Input
                id={id}
                type="text"
                placeholder="hostname:port:ip-address"
                value={options?.hostOverride ?? ""}
                onChange={(e) => actions.updateClientOption({ hostOverride: e.target.value ?? "" })}
                className={cn("font-mono", original?.hostOverride !== options?.hostOverride && "unsaved-changes")}
              />
            )}
          </OptionField>
        </div>

        <div className="grid grid-cols-[8rem_1fr] items-start gap-4">
          <Label className="pt-2.5 text-right text-sm text-muted-foreground">Custom CA Bundle</Label>
          <div className="space-y-2">
            <RadioGroup
              value={caBundleSource}
              onValueChange={(value) => setCaBundleSource(value as "path" | "text")}
              className="flex items-center gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="path" id={caPathOptionId} />
                <Label htmlFor={caPathOptionId} className="cursor-pointer font-normal">
                  File Path
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="text" id={caTextOptionId} />
                <Label htmlFor={caTextOptionId} className="cursor-pointer font-normal">
                  Pasted Text
                </Label>
              </div>
            </RadioGroup>

            {caBundleSource === "path" ? (
              <Input
                type="text"
                placeholder="/path/to/ca-bundle.pem"
                value={options?.caPath ?? ""}
                onChange={(e) => actions.updateClientOption({ caPath: e.target.value, caText: undefined })}
                className={cn("font-mono", original?.caPath !== options?.caPath && "unsaved-changes")}
                endAddon={
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-l-none"
                    onClick={async () => {
                      try {
                        const opened = await openFile({
                          title: "Select CA Bundle (PEM)",
                          filters: [
                            { name: "PEM / CRT", extensions: ["pem", "crt", "cer"] },
                            { name: "All Files", extensions: ["*"] },
                          ],
                          readContent: false,
                        })
                        if (opened?.filePath) {
                          actions.updateClientOption({ caPath: opened.filePath, caText: undefined })
                          setCaBundleSource("path")
                        }
                      } catch (_e) {
                        // Swallow user-cancelled or IO errors; optional UX toast later
                      }
                    }}
                  >
                    Browse…
                  </Button>
                }
              />
            ) : (
              <Textarea
                placeholder="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
                value={options?.caText ?? ""}
                onChange={(e) => actions.updateClientOption({ caText: e.target.value, caPath: undefined })}
                className={cn("min-h-[120px] font-mono", original?.caText !== options?.caText && "unsaved-changes")}
                rows={5}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
