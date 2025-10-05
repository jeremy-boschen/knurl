import React, { type FC, type ReactNode, useId } from "react"

import type { AuthConfig as BindingAuthConfig } from "@/bindings/knurl"
import { getAuthenticationResult, discoverOidc } from "@/bindings/knurl"
import { OAuth2Editor } from "@/components/auth/oauth2-editor"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/knurl/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { credentialsCacheApi, useApplication, useCollection } from "@/state"
import type { CollectionState } from "@/types"
import type { ApiKeyAuth, AuthType, BasicAuth, BearerAuth, OAuth2Auth } from "@/types/request"
import { AuthTypes } from "@/types/request"

type Props = {
  collectionId: string
}

// --- Layout Field ---
type AuthFieldProps = {
  label: ReactNode
  placement?: "left" | "right"
  children: (id: string) => ReactNode
  className?: string
}

function AuthField({ label, children, className, placement = "left" }: AuthFieldProps) {
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

// --- Basic ---
type BasicAuthFormProps = { auth: Partial<BasicAuth>; onUpdate: (updates: Record<string, unknown>) => void }
const BasicAuthForm: FC<BasicAuthFormProps> = ({ auth, onUpdate }) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    <AuthField label="Username">
      {(id) => (
        <Input
          id={id}
          type="text"
          value={auth.username ?? ""}
          onChange={(e) => onUpdate({ username: e.target.value })}
          className="w-full font-mono"
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
        />
      )}
    </AuthField>
  </div>
)

// --- Bearer ---
type BearerAuthFormProps = {
  auth: Partial<BearerAuth>
  onUpdate: (updates: Record<string, unknown>) => void
  onPlacementUpdate: (updates: Record<string, unknown>) => void
}

const BearerAuthForm: FC<BearerAuthFormProps> = ({ auth, onUpdate, onPlacementUpdate }) => {
  const placementType = auth.placement?.type ?? "header"
  const scheme = auth.scheme ?? "Bearer"
  const schemeMode: "Bearer" | "JWT" | "custom" =
    scheme === "Bearer" || scheme === "JWT" ? (scheme as "Bearer" | "JWT") : "custom"
  return (
    <div className="max-w-2xl space-y-4">
      <AuthField label="Token">
        {(id) => (
          <Input
            id={id}
            type="password"
            value={auth.token ?? ""}
            onChange={(e) => onUpdate({ token: e.target.value })}
            className="w-full font-mono"
          />
        )}
      </AuthField>
      {placementType === "header" && (
        <>
          <AuthField label="Scheme">
            {(id) => (
              <Select
                value={schemeMode}
                onValueChange={(value) => (value === "custom" ? onUpdate({ scheme: "" }) : onUpdate({ scheme: value }))}
              >
                <SelectTrigger id={id} className="w-full text-sm">
                  <SelectValue placeholder="Select scheme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bearer">Bearer</SelectItem>
                  <SelectItem value="JWT">JWT</SelectItem>
                  <SelectItem value="custom">Custom…</SelectItem>
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
                  onChange={(e) => onUpdate({ scheme: e.target.value })}
                  placeholder="e.g., Token"
                  className="w-full font-mono"
                />
              )}
            </AuthField>
          )}
        </>
      )}
      <AuthField label="Placement">
        {(id) => (
          <Select value={placementType} onValueChange={(value) => onPlacementUpdate({ type: value })}>
            <SelectTrigger id={id} className="w-full text-sm">
              <SelectValue placeholder="Select placement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="header">Header</SelectItem>
              <SelectItem value="query">Query Param</SelectItem>
              <SelectItem value="cookie">Cookie</SelectItem>
              <SelectItem value="body">Body</SelectItem>
            </SelectContent>
          </Select>
        )}
      </AuthField>

      {(placementType === "header" || placementType === "query" || placementType === "cookie") && (
        <AuthField label={placementType === "header" ? "Header Name" : "Name"}>
          {(id) => (
            <Input
              id={id}
              type="text"
              value={auth.placement?.name ?? ""}
              onChange={(e) => onPlacementUpdate({ name: e.target.value })}
              className="w-full font-mono"
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
                value={auth.placement?.fieldName ?? ""}
                onChange={(e) => onPlacementUpdate({ fieldName: e.target.value })}
                className="w-full font-mono"
              />
            )}
          </AuthField>
          <AuthField label="Content-Type">
            {(id) => (
              <Input
                id={id}
                type="text"
                value={auth.placement?.contentType ?? ""}
                onChange={(e) => onPlacementUpdate({ contentType: e.target.value })}
                className="w-full font-mono"
              />
            )}
          </AuthField>
        </>
      )}
    </div>
  )
}

// --- API Key ---
type ApiKeyAuthFormProps = {
  auth: Partial<ApiKeyAuth>
  onUpdate: (updates: Record<string, unknown>) => void
  onPlacementUpdate: (updates: Record<string, unknown>) => void
}

const ApiKeyAuthForm: FC<ApiKeyAuthFormProps> = ({ auth, onUpdate, onPlacementUpdate }) => {
  const placementType = auth.placement?.type ?? "header"
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <AuthField label="Key">
          {(id) => (
            <Input
              id={id}
              type="text"
              value={auth.key ?? ""}
              onChange={(e) => onUpdate({ key: e.target.value })}
              className="w-full font-mono"
            />
          )}
        </AuthField>
        <AuthField label="Value">
          {(id) => (
            <Input
              id={id}
              type="password"
              value={auth.value ?? ""}
              onChange={(e) => onUpdate({ value: e.target.value })}
              className="w-full font-mono"
            />
          )}
        </AuthField>
      </div>
      <AuthField label="Placement">
        {(id) => (
          <Select value={placementType} onValueChange={(value) => onPlacementUpdate({ type: value })}>
            <SelectTrigger id={id} className="w-full text-sm">
              <SelectValue placeholder="Select placement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="header">Header</SelectItem>
              <SelectItem value="query">Query Param</SelectItem>
              <SelectItem value="cookie">Cookie</SelectItem>
              <SelectItem value="body">Body</SelectItem>
            </SelectContent>
          </Select>
        )}
      </AuthField>

      {(placementType === "header" || placementType === "query" || placementType === "cookie") && (
        <AuthField label="Name">
          {(id) => (
            <Input
              id={id}
              type="text"
              value={auth.placement?.name ?? ""}
              onChange={(e) => onPlacementUpdate({ name: e.target.value })}
              className="w-full font-mono"
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
                value={auth.placement?.fieldName ?? ""}
                onChange={(e) => onPlacementUpdate({ fieldName: e.target.value })}
                className="w-full font-mono"
              />
            )}
          </AuthField>
          <AuthField label="Content-Type">
            {(id) => (
              <Input
                id={id}
                type="text"
                value={auth.placement?.contentType ?? ""}
                onChange={(e) => onPlacementUpdate({ contentType: e.target.value })}
                className="w-full font-mono"
              />
            )}
          </AuthField>
        </div>
      )}
    </div>
  )
}

// --- OAuth2 ---
type OAuth2AuthFormProps = {
  auth: Partial<OAuth2Auth>
  onUpdate: (updates: Record<string, unknown>) => void
  onDiscover: () => void
  collectionId: string
}

// (removed legacy inline OAuth2 form in favor of shared editor)

// Shared-editor wrapper used by renderAuthForm
const OAuth2AuthFormShared: FC<OAuth2AuthFormProps> = ({ auth, onUpdate, onDiscover, collectionId }) => {
  const grantType = auth.grantType ?? "client_credentials"
  const cacheKey = React.useMemo(() => `collection-auth-${collectionId}`, [collectionId])
  const _cacheEntry = useApplication((state) => state.credentialsCacheState?.cache?.[cacheKey])

  const [cachedToken, setCachedToken] = React.useState<string>("")
  const [tokenType, setTokenType] = React.useState<string>("")
  const [expiresAtSec, setExpiresAtSec] = React.useState<number | undefined>(undefined)

  React.useEffect(() => {
    ;(async () => {
      try {
        const result = await credentialsCacheApi().get(cacheKey)
        if (!result) {
          setCachedToken("")
          setTokenType("")
          setExpiresAtSec(undefined)
          return
        }
        const headers = result.headers ?? {}
        const authHeader = headers.Authorization ?? headers.authorization
        setExpiresAtSec(typeof result.expiresAt === "number" ? result.expiresAt : undefined)
        if (authHeader && typeof authHeader === "string") {
          const parts = authHeader.split(/\s+/)
          setTokenType(parts[0] ?? "")
          setCachedToken(parts.length > 1 ? parts.slice(1).join(" ") : authHeader)
          return
        }
        setTokenType("")
        setCachedToken("")
      } catch {
        setTokenType("")
        setCachedToken("")
        setExpiresAtSec(undefined)
      }
    })()
  }, [cacheKey])

  return (
    <OAuth2Editor
      auth={auth}
      onUpdate={onUpdate}
      onDiscover={onDiscover}
      token={{
        value: cachedToken,
        type: tokenType,
        expiresAtSec,
        onFetch: async () => {
          try {
            const binding: BindingAuthConfig = {
              type: "oauth2",
              grantType: grantType,
              authUrl: auth.authUrl,
              tokenUrl: auth.tokenUrl,
              clientId: auth.clientId,
              clientSecret: auth.clientSecret,
              scope: auth.scope,
              refreshToken: auth.refreshToken,
              tokenCaching: auth.tokenCaching ?? "always",
              clientAuth: auth.clientAuth ?? "body",
              tokenExtraParams: auth.tokenExtraParams,
            }
            const result = await getAuthenticationResult(binding, `collection-auth-${collectionId}`)
            await credentialsCacheApi().set(cacheKey, result)
          } catch (e) {
            console.error("Collection OAuth2 fetch failed:", e)
          }
        },
        onDelete: () => {
          credentialsCacheApi().remove(cacheKey)
          setCachedToken("")
          setTokenType("")
          setExpiresAtSec(undefined)
        },
      }}
    />
  )
}

// --- Main Panel ---
export default function CollectionAuthPanel({ collectionId }: Props) {
  const {
    state: { collection },
    actions: { collectionsApi },
  } = useCollection(collectionId)

  if (!collection) {
    return null
  }

  const authentication = collection.authentication
  const authType = authentication?.type ?? "none"

  const handleAuthTypeChange = (value: AuthType) => {
    // disallow inherit at collection level
    if (value === "inherit") {
      return
    }
    const base =
      value === "oauth2"
        ? {
            type: "oauth2" as const,
            oauth2: { grantType: "client_credentials", tokenCaching: "always", clientAuth: "body" } as const,
          }
        : ({ type: value } as const)
    void collectionsApi().updateCollection(collection.id, { authentication: base } as Partial<CollectionState>)
  }

  const handleInputChange = (updates: Record<string, unknown>) => {
    if (authType === "none" || authType === "inherit") {
      return
    }
    const next = {
      authentication: {
        type: authType,
        [authType]: {
          // @ts-expect-error index access
          ...(authentication[authType] ?? {}),
          ...updates,
        },
      },
    }
    void collectionsApi().updateCollection(collection.id, next as Partial<CollectionState>)
  }

  const handlePlacementChange = (updates: Record<string, unknown>) => {
    if (authentication.type !== "apiKey" && authentication.type !== "bearer") {
      return
    }
    // @ts-expect-error index access
    const current = authentication[authentication.type] ?? {}
    const next = {
      authentication: {
        type: authentication.type,
        [authentication.type]: {
          ...current,
          placement: { ...(current.placement ?? {}), ...updates },
        },
      },
    }
    void collectionsApi().updateCollection(collection.id, next as Partial<CollectionState>)
  }

  const handleDiscover = async () => {
    if (authentication.type !== "oauth2") {
      return
    }
    const oauth2 = authentication.oauth2 ?? {}
    // Prefer explicit discoveryUrl; if it already includes .well-known, use as-is.
    // Fallback to deriving from authUrl if discoveryUrl is absent.
    const discoveryBase = oauth2.discoveryUrl || oauth2.authUrl
    if (!discoveryBase) {
      return
    }
    try {
      const normalized = discoveryBase.replace(/\/$/, "")
      const url = /\.well-known\//.test(normalized) ? normalized : `${normalized}/.well-known/openid-configuration`
      const result = await discoverOidc(url)
      handleInputChange({ authUrl: result.authorizationEndpoint, tokenUrl: result.tokenEndpoint })
    } catch (err) {
      console.error("OIDC Discovery failed:", err)
    }
  }

  const renderAuthForm = () => {
    switch (authentication.type) {
      case "basic":
        return <BasicAuthForm auth={authentication.basic ?? {}} onUpdate={handleInputChange} />
      case "bearer":
        return (
          <BearerAuthForm
            auth={authentication.bearer ?? {}}
            onUpdate={handleInputChange}
            onPlacementUpdate={handlePlacementChange}
          />
        )
      case "apiKey":
        return (
          <ApiKeyAuthForm
            auth={authentication.apiKey ?? {}}
            onUpdate={handleInputChange}
            onPlacementUpdate={handlePlacementChange}
          />
        )
      case "oauth2":
        return (
          <OAuth2AuthFormShared
            collectionId={collectionId}
            auth={authentication.oauth2 ?? {}}
            onUpdate={handleInputChange}
            onDiscover={handleDiscover}
          />
        )
      default:
        return (
          <div className="flex h-32 items-center justify-center">
            <p className="text-muted-foreground">No authentication is configured for this collection.</p>
          </div>
        )
    }
  }

  const typeLabels = Object.entries(AuthTypes).filter(([k]) => k !== "inherit")

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background p-4 text-sm">
      <div className="mb-3">
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            Set the default authentication for all requests in this collection. Individual requests can override these
            settings.
          </AlertDescription>
        </Alert>
      </div>

      <div className="flex items-center gap-3 pb-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" className="w-48 justify-start text-sm">
              {AuthTypes[authType]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuRadioGroup value={authType} onValueChange={(v) => handleAuthTypeChange(v as AuthType)}>
              {typeLabels.map(([type, name]) => (
                <DropdownMenuRadioItem key={type} value={type}>
                  {name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="pt-2">{renderAuthForm()}</div>
    </div>
  )
}
