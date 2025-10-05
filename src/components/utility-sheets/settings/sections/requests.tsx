import { Input } from "@/components/ui/knurl/input"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { useDebouncedCallback } from "@/hooks/use-debounced-callback"
import { useSettings } from "@/state"
import { SettingRow } from "./setting-row"

export default function RequestsSection() {
  const {
    state: settingsState,
    actions: { settingsApi },
  } = useSettings()

  const handleTimeoutChange = useDebouncedCallback((value: number) => {
    settingsApi().setRequestTimeout(value || 1)
  }, 300)

  const handleRedirectsChange = useDebouncedCallback((value: number) => {
    settingsApi().setMaxRedirects(value || 0)
  }, 300)

  const handleProxyChange = useDebouncedCallback((value: string) => {
    const v = value.trim()
    settingsApi().setProxyServer(v.length ? v : undefined)
  }, 400)

  const handlePreviewMaxChange = useDebouncedCallback((value: number) => {
    const bytes = Math.max(1, value) * 1024 * 1024
    settingsApi().setPreviewMaxBytes(bytes)
  }, 300)

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-6 p-1">
      <SettingRow label="Request timeout" description="Maximum time to wait for responses (seconds)">
        <Input
          type="number"
          min="1"
          className="w-24"
          defaultValue={String(settingsState.requests.timeout)}
          onChange={(e) => handleTimeoutChange(Number(e.target.value))}
        />
      </SettingRow>

      <Separator className="mt-4 mb-4" />

      <SettingRow
        label="Maximum Redirects"
        description={
          <span>
            Number of redirects to automatically follow. A value of <u>0</u> will disable this feature.
          </span>
        }
      >
        <Input
          type="number"
          min="0"
          className="w-24"
          defaultValue={String(settingsState.requests.maxRedirects)}
          onChange={(e) => handleRedirectsChange(Number(e.target.value))}
        />
      </SettingRow>

      <Separator className="mt-4 mb-4" />

      <SettingRow label="SSL certificate verification" description="Verify SSL certificates for HTTPS requests">
        <Switch
          checked={!settingsState.requests.disableSsl}
          onCheckedChange={(checked) => settingsApi().setSslVerify(checked)}
        />
      </SettingRow>

      <Separator className="mt-4 mb-4" />

      <SettingRow
        label="Proxy URL"
        description="Route requests through a proxy server (optional)"
        className="flex flex-col items-stretch gap-2"
      >
        <div className="flex">
          <Input
            placeholder="http://proxy.example.com:8080"
            defaultValue={settingsState.requests.proxyServer ?? ""}
            onChange={(e) => handleProxyChange(e.target.value)}
          />
        </div>
      </SettingRow>

      <Separator className="mt-4 mb-4" />

      <SettingRow
        label="Preview size limit"
        description="Maximum response size (MB) to show inline previews. Larger responses are streamed to disk."
      >
        <Input
          type="number"
          min="1"
          className="w-24"
          defaultValue={String(Math.floor((settingsState.requests.previewMaxBytes ?? 20971520) / 1048576))}
          onChange={(e) => handlePreviewMaxChange(Number(e.target.value))}
        />
      </SettingRow>
    </div>
  )
}
