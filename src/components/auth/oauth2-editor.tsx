import React, { type FC } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/knurl/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { OAuth2Auth } from "@/types/request"

type FieldProps = {
  label: React.ReactNode
  children: (id: string) => React.ReactNode
}

const Field: FC<FieldProps> = ({ label, children }) => {
  const id = React.useId()
  return (
    <div className="grid items-center gap-x-4 grid-cols-[6rem_auto]">
      <Label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </Label>
      <div className="min-w-0">{children(id)}</div>
    </div>
  )
}

export type OAuth2EditorProps = {
  auth: Partial<OAuth2Auth>
  onUpdate: (updates: Record<string, unknown>) => void
  onDiscover: () => void
  token?: {
    value: string
    type?: string
    expiresAtSec?: number
    onFetch?: () => void
    onDelete?: () => void
  }
}

export const OAuth2Editor: FC<OAuth2EditorProps> = ({ auth, onUpdate, onDiscover, token }) => {
  const grantType = auth.grantType ?? "client_credentials"

  const renderTokenMeta = () => {
    if (!token) {
      return null
    }
    const pieces: string[] = []
    if (token.type) {
      pieces.push(token.type)
    }
    if (typeof token.expiresAtSec === "number" && token.expiresAtSec > 0) {
      const nowSec = Math.floor(Date.now() / 1000)
      const diff = token.expiresAtSec - nowSec
      const abs = Math.abs(diff)
      const mins = Math.floor(abs / 60)
      const secs = abs % 60
      const h = Math.floor(mins / 60)
      const m = mins % 60
      const span = h > 0 ? `${h}h ${m}m` : mins > 0 ? `${mins}m` : `${secs}s`
      pieces.push(diff >= 0 ? `expires in ${span}` : `expired ${span} ago`)
    }
    if (pieces.length === 0) {
      return null
    }
    return <div className="mt-1 text-xs text-muted-foreground">{pieces.join(", ")}</div>
  }

  return (
    <div className="space-y-4">
      <Field label="Discovery URL">
        {(id) => (
          <Input
            id={id}
            type="text"
            value={auth.discoveryUrl ?? ""}
            onChange={(e) => onUpdate({ discoveryUrl: e.target.value })}
            placeholder="Issuer base or full .well-known URL"
            className="w-full font-mono"
            endAddon={
              <Button variant="ghost" size="sm" onClick={onDiscover}>
                Discover
              </Button>
            }
          />
        )}
      </Field>
      <div className="-mt-3 text-xs text-muted-foreground">
        Accepts issuer base (e.g., https://auth.example.com) or a full .well-known URL. Discover fills Auth/Token URLs.
      </div>

      <Field label="Grant Type">
        {(id) => (
          <Select value={grantType} onValueChange={(value) => onUpdate({ grantType: value })}>
            <SelectTrigger id={id} className="w-full text-sm">
              <SelectValue placeholder="Select grant type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="client_credentials">Client Credentials</SelectItem>
              <SelectItem value="refresh_token">Refresh Token</SelectItem>
              <SelectItem value="device_code">Device Code</SelectItem>
            </SelectContent>
          </Select>
        )}
      </Field>

      <Field label="Auth URL">
        {(id) => (
          <Input
            id={id}
            type="text"
            value={auth.authUrl ?? ""}
            onChange={(e) => onUpdate({ authUrl: e.target.value })}
            className="w-full font-mono"
          />
        )}
      </Field>

      {(grantType === "client_credentials" || !grantType) && (
        <Field label="Token URL">
          {(id) => (
            <Input
              id={id}
              type="text"
              value={auth.tokenUrl ?? ""}
              onChange={(e) => onUpdate({ tokenUrl: e.target.value })}
              className="w-full font-mono"
            />
          )}
        </Field>
      )}

      {grantType === "client_credentials" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Client ID">
            {(id) => (
              <Input
                id={id}
                type="text"
                value={auth.clientId ?? ""}
                onChange={(e) => onUpdate({ clientId: e.target.value })}
                className="w-full font-mono"
              />
            )}
          </Field>
          <Field label="Client Secret">
            {(id) => (
              <Input
                id={id}
                type="password"
                value={auth.clientSecret ?? ""}
                onChange={(e) => onUpdate({ clientSecret: e.target.value })}
                className="w-full font-mono"
              />
            )}
          </Field>
        </div>
      )}

      {grantType === "client_credentials" && (
        <Field label="Scope">
          {(id) => (
            <Input
              id={id}
              type="text"
              value={auth.scope ?? ""}
              onChange={(e) => onUpdate({ scope: e.target.value })}
              className="w-full font-mono"
            />
          )}
        </Field>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Client Authentication">
          {(id) => (
            <Select value={auth.clientAuth ?? "body"} onValueChange={(value) => onUpdate({ clientAuth: value })}>
              <SelectTrigger id={id} className="w-full text-sm">
                <SelectValue placeholder="Select auth" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="body">Request body (client_id/client_secret)</SelectItem>
                <SelectItem value="basic">Authorization header (Basic)</SelectItem>
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label="Token Strategy">
          {(id) => (
            <Select value={auth.tokenCaching ?? "always"} onValueChange={(value) => onUpdate({ tokenCaching: value })}>
              <SelectTrigger id={id} className="w-full text-sm">
                <SelectValue placeholder="Select token strategy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="always">Use cached if available</SelectItem>
                <SelectItem value="never">Always refresh (write cache)</SelectItem>
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>

      {token && (
        <Field label="Access Token">
          {(id) => (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Input id={id} type="password" readOnly value={token.value} className="w-full font-mono" />
                {token.onFetch && (
                  <Button variant="secondary" size="sm" onClick={token.onFetch}>
                    Fetch
                  </Button>
                )}
                {token.onDelete && (
                  <Button variant="outline" size="sm" onClick={token.onDelete} disabled={!token.value}>
                    Delete
                  </Button>
                )}
              </div>
              {renderTokenMeta()}
            </div>
          )}
        </Field>
      )}

      {grantType === "refresh_token" && (
        <Field label="Refresh Token">
          {(id) => (
            <Input
              id={id}
              type="password"
              value={auth.refreshToken ?? ""}
              onChange={(e) => onUpdate({ refreshToken: e.target.value })}
              className="w-full font-mono"
            />
          )}
        </Field>
      )}
    </div>
  )
}
