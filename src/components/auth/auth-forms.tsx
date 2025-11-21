import { type FC, type ReactNode, useId } from "react"

import { Input } from "@/components/ui/knurl/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { BasicAuth } from "@/types/request"
import { zApiKeyAuth, zBearerAuth } from "@/types/request"

// --- Layout Field ---
export type AuthFieldProps = {
  label: ReactNode
  placement?: "left" | "right"
  children: (id: string) => ReactNode
  className?: string
}

export function AuthField({ label, children, className, placement = "left" }: AuthFieldProps) {
  const id = useId()
  return (
    <div
      className={cn(
        "grid items-center gap-x-4",
        placement === "left" ? "grid-cols-[6rem_auto]" : "grid-cols-[6rem_auto]",
        className,
      )}
    >
      <Label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </Label>
      <div className="min-w-0">{children(id)}</div>
    </div>
  )
}

// --- Basic Auth ---
export type BasicAuthFormProps = {
  auth: Partial<BasicAuth>
  onUpdate: (updates: Record<string, unknown>) => void
  testIdPrefix?: string
}

export const BasicAuthForm: FC<BasicAuthFormProps> = ({ auth, onUpdate, testIdPrefix = "request-auth-panel" }) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-test-id={`${testIdPrefix}:basic-auth-form`}>
    <AuthField label="Username">
      {(id) => (
        <Input
          id={id}
          type="text"
          value={auth.username ?? ""}
          onChange={(e) => onUpdate({ username: e.target.value })}
          className="w-full font-mono"
          data-test-id={`${testIdPrefix}:basic-auth-username-input`}
        />
      )}
    </AuthField>
    <AuthField label="Password" placement="right">
      {(id) => (
        <Input
          id={id}
          type="password"
          value={auth.password ?? ""}
          onChange={(e) => onUpdate({ password: e.target.value })}
          className="w-full font-mono"
          data-test-id={`${testIdPrefix}:basic-auth-password-input`}
        />
      )}
    </AuthField>
  </div>
)

// --- Bearer Auth ---
export type BearerAuthFormProps = {
  auth: Partial<BearerAuth>
  onUpdate: (updates: Record<string, unknown>) => void
  onPlacementUpdate: (updates: Record<string, unknown>) => void
  canUseBodyPlacement?: boolean
  testIdPrefix?: string
}

export const BearerAuthForm: FC<BearerAuthFormProps> = ({
  auth,
  onUpdate,
  onPlacementUpdate,
  canUseBodyPlacement = true,
  testIdPrefix = "request-auth-panel",
}) => {
  // Normalize auth data using Zod to ensure defaults are applied
  const normalizedAuth = zBearerAuth.parse(auth)

  const placementType = normalizedAuth.placement?.type ?? "header"
  const scheme = normalizedAuth.scheme ?? "Bearer"
  const schemeMode: "Bearer" | "JWT" | "custom" =
    scheme === "Bearer" || scheme === "JWT" ? (scheme as "Bearer" | "JWT") : "custom"

  // Wrapper for onUpdate that normalizes the updates before calling parent
  const handleUpdate = (updates: Record<string, unknown>) => {
    const merged = { ...normalizedAuth, ...updates }
    const normalized = zBearerAuth.parse(merged)
    onUpdate(normalized)
  }

  // Wrapper for onPlacementUpdate that normalizes before calling parent
  const handlePlacementUpdate = (updates: Record<string, unknown>) => {
    const merged = { ...normalizedAuth, placement: { ...(normalizedAuth.placement ?? {}), ...updates } }
    const normalized = zBearerAuth.parse(merged)
    onPlacementUpdate({ placement: normalized.placement })
  }

  return (
    <div className="max-w-2xl space-y-4" data-test-id={`${testIdPrefix}:bearer-auth-form`}>
      <AuthField label="Token">
        {(id) => (
          <Input
            id={id}
            type="password"
            value={normalizedAuth.token ?? ""}
            onChange={(e) => handleUpdate({ token: e.target.value })}
            className="w-full font-mono"
            data-test-id={`${testIdPrefix}:bearer-auth-token-input`}
          />
        )}
      </AuthField>
      {placementType === "header" && (
        <>
          <AuthField label="Scheme">
            {(id) => (
              <Select
                value={schemeMode}
                onValueChange={(value) => {
                  if (value === "custom") {
                    return handleUpdate({ scheme: "" })
                  }
                  handleUpdate({ scheme: value })
                }}
              >
                <SelectTrigger
                  id={id}
                  className="w-full text-sm"
                  data-test-id={`${testIdPrefix}:bearer-auth-scheme-select`}
                >
                  <SelectValue placeholder="Select scheme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bearer" data-test-id={`${testIdPrefix}:bearer-auth-scheme-bearer`}>
                    Bearer
                  </SelectItem>
                  <SelectItem value="JWT" data-test-id={`${testIdPrefix}:bearer-auth-scheme-jwt`}>
                    JWT
                  </SelectItem>
                  <SelectItem value="custom" data-test-id={`${testIdPrefix}:bearer-auth-scheme-custom`}>
                    Custom…
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </AuthField>
          {schemeMode === "custom" && (
            <AuthField label="Custom Scheme">
              {(id) => (
                <Input
                  id={id}
                  type="text"
                  value={scheme}
                  onChange={(e) => handleUpdate({ scheme: e.target.value })}
                  placeholder="e.g., Token"
                  className="w-full font-mono"
                  data-test-id={`${testIdPrefix}:bearer-auth-custom-scheme-input`}
                />
              )}
            </AuthField>
          )}
        </>
      )}
      <AuthField label="Placement">
        {(id) => (
          <Select value={placementType} onValueChange={(value) => handlePlacementUpdate({ type: value })}>
            <SelectTrigger
              id={id}
              className="w-full text-sm"
              data-test-id={`${testIdPrefix}:bearer-auth-placement-select`}
            >
              <SelectValue placeholder="Select placement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="header" data-test-id={`${testIdPrefix}:bearer-auth-placement-option:header`}>
                Header
              </SelectItem>
              <SelectItem value="query" data-test-id={`${testIdPrefix}:bearer-auth-placement-option:query`}>
                Query Param
              </SelectItem>
              <SelectItem value="cookie" data-test-id={`${testIdPrefix}:bearer-auth-placement-option:cookie`}>
                Cookie
              </SelectItem>
              <SelectItem
                value="body"
                disabled={!canUseBodyPlacement}
                data-test-id={`${testIdPrefix}:bearer-auth-placement-option:body`}
              >
                Body
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      </AuthField>
      {!canUseBodyPlacement && (
        <div className="-mt-3 text-xs text-muted-foreground">
          Body placement requires a Form body using URL-encoded or Multipart encoding.
        </div>
      )}

      {(placementType === "header" || placementType === "query" || placementType === "cookie") && (
        <AuthField label={placementType === "header" ? "Header Name" : "Name"}>
          {(id) => (
            <Input
              id={id}
              type="text"
              value={normalizedAuth.placement?.name ?? ""}
              onChange={(e) => handlePlacementUpdate({ name: e.target.value })}
              className="w-full font-mono"
              data-test-id={`${testIdPrefix}:bearer-auth-placement-name-input`}
            />
          )}
        </AuthField>
      )}

      {placementType === "body" && (
        <>
          <AuthField label="Field Name">
            {(id) => (
              <Input
                id={id}
                type="text"
                value={normalizedAuth.placement?.fieldName ?? ""}
                onChange={(e) => handlePlacementUpdate({ fieldName: e.target.value })}
                className="w-full font-mono"
                data-test-id={`${testIdPrefix}:bearer-auth-placement-field-name-input`}
              />
            )}
          </AuthField>
          <AuthField label="Content-Type">
            {(id) => (
              <Input
                id={id}
                type="text"
                value={normalizedAuth.placement?.contentType ?? ""}
                onChange={(e) => handlePlacementUpdate({ contentType: e.target.value })}
                className="w-full font-mono"
                data-test-id={`${testIdPrefix}:bearer-auth-placement-content-type-input`}
              />
            )}
          </AuthField>
        </>
      )}
    </div>
  )
}

// --- API Key Auth ---
export type ApiKeyAuthFormProps = {
  auth: Partial<ApiKeyAuth>
  onUpdate: (updates: Record<string, unknown>) => void
  onPlacementUpdate: (updates: Record<string, unknown>) => void
  canUseBodyPlacement?: boolean
  testIdPrefix?: string
}

export const ApiKeyAuthForm: FC<ApiKeyAuthFormProps> = ({
  auth,
  onUpdate,
  onPlacementUpdate,
  canUseBodyPlacement = true,
  testIdPrefix = "request-auth-panel",
}) => {
  // Normalize auth data using Zod to ensure defaults are applied
  const normalizedAuth = zApiKeyAuth.parse(auth)

  const placementType = normalizedAuth.placement?.type ?? "header"

  // Wrapper for onUpdate that normalizes the updates before calling parent
  const handleUpdate = (updates: Record<string, unknown>) => {
    const merged = { ...normalizedAuth, ...updates }
    const normalized = zApiKeyAuth.parse(merged)
    onUpdate(normalized)
  }

  // Wrapper for onPlacementUpdate that normalizes before calling parent
  const handlePlacementUpdate = (updates: Record<string, unknown>) => {
    const merged = { ...normalizedAuth, placement: { ...(normalizedAuth.placement ?? {}), ...updates } }
    const normalized = zApiKeyAuth.parse(merged)
    onPlacementUpdate({ placement: normalized.placement })
  }

  return (
    <div className="space-y-4" data-test-id={`${testIdPrefix}:api-key-auth-form`}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <AuthField label="Key">
          {(id) => (
            <Input
              id={id}
              type="text"
              value={normalizedAuth.key ?? ""}
              onChange={(e) => handleUpdate({ key: e.target.value })}
              className="w-full font-mono"
              data-test-id={`${testIdPrefix}:api-key-auth-key-input`}
            />
          )}
        </AuthField>
        <AuthField label="Value">
          {(id) => (
            <Input
              id={id}
              type="password"
              value={normalizedAuth.value ?? ""}
              onChange={(e) => handleUpdate({ value: e.target.value })}
              className="w-full font-mono"
              data-test-id={`${testIdPrefix}:api-key-auth-value-input`}
            />
          )}
        </AuthField>
      </div>
      <AuthField label="Placement">
        {(id) => (
          <Select value={placementType} onValueChange={(value) => handlePlacementUpdate({ type: value })}>
            <SelectTrigger
              id={id}
              className="w-full text-sm"
              data-test-id={`${testIdPrefix}:api-key-auth-placement-select`}
            >
              <SelectValue placeholder="Select placement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="header" data-test-id={`${testIdPrefix}:api-key-auth-placement-option:header`}>
                Header
              </SelectItem>
              <SelectItem value="query" data-test-id={`${testIdPrefix}:api-key-auth-placement-option:query`}>
                Query Param
              </SelectItem>
              <SelectItem value="cookie" data-test-id={`${testIdPrefix}:api-key-auth-placement-option:cookie`}>
                Cookie
              </SelectItem>
              <SelectItem
                value="body"
                disabled={!canUseBodyPlacement}
                data-test-id={`${testIdPrefix}:api-key-auth-placement-option:body`}
              >
                Body
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      </AuthField>
      {!canUseBodyPlacement && (
        <div className="-mt-3 text-xs text-muted-foreground">
          Body placement requires a Form body using URL-encoded or Multipart encoding.
        </div>
      )}

      {(placementType === "header" || placementType === "query" || placementType === "cookie") && (
        <AuthField label="Name">
          {(id) => (
            <Input
              id={id}
              type="text"
              value={normalizedAuth.placement?.name ?? ""}
              onChange={(e) => handlePlacementUpdate({ name: e.target.value })}
              className="w-full font-mono"
              data-test-id={`${testIdPrefix}:api-key-auth-placement-name-input`}
            />
          )}
        </AuthField>
      )}

      {placementType === "body" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <AuthField label="Field Name">
            {(id) => (
              <Input
                id={id}
                type="text"
                value={normalizedAuth.placement?.fieldName ?? ""}
                onChange={(e) => handlePlacementUpdate({ fieldName: e.target.value })}
                className="w-full font-mono"
                data-test-id={`${testIdPrefix}:api-key-auth-placement-field-name-input`}
              />
            )}
          </AuthField>
          <AuthField label="Content-Type">
            {(id) => (
              <Input
                id={id}
                type="text"
                value={normalizedAuth.placement?.contentType ?? ""}
                onChange={(e) => handlePlacementUpdate({ contentType: e.target.value })}
                className="w-full font-mono"
                data-test-id={`${testIdPrefix}:api-key-auth-placement-content-type-input`}
              />
            )}
          </AuthField>
        </div>
      )}
    </div>
  )
}
