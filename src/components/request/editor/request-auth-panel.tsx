import React, { type FC, type ReactNode, useId } from "react"

import { useShallow } from "zustand/shallow"

import { discoverOidc } from "@/bindings/knurl"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/knurl/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { OAuth2Editor } from "@/components/auth/oauth2-editor"
import { SectionHeader } from "./section-header"
import { credentialsCacheApi, useApplication } from "@/state/application"
import { useCollections, useRequestTab } from "@/state"
import type { ApiKeyAuth, BasicAuth, BearerAuth, OAuth2Auth } from "@/types/request"
import { AuthTypes } from "@/types/request"

export type RequestAuthPanelProps = {
  tabId: string
}

// --- Layout Components ---

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

// --- Auth Type Forms ---

type BasicAuthFormProps = {
  auth: Partial<BasicAuth>
  onUpdate: (updates: Record<string, unknown>) => void
}

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

type BearerAuthFormProps = {
  auth: Partial<BearerAuth>
  onUpdate: (updates: Record<string, unknown>) => void
  onPlacementUpdate: (updates: Record<string, unknown>) => void
  canUseBodyPlacement: boolean
}

const BearerAuthForm: FC<BearerAuthFormProps> = ({ auth, onUpdate, onPlacementUpdate, canUseBodyPlacement }) => {
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
                onValueChange={(value) => {
                  if (value === "custom") {
                    // Switch to custom: start blank so user can type
                    return onUpdate({ scheme: "" })
                  }
                  onUpdate({ scheme: value })
                }}
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
              <SelectItem value="body" disabled={!canUseBodyPlacement}>
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

type ApiKeyAuthFormProps = {
  auth: Partial<ApiKeyAuth>
  onUpdate: (updates: Record<string, unknown>) => void
  onPlacementUpdate: (updates: Record<string, unknown>) => void
}

const ApiKeyAuthForm: FC<ApiKeyAuthFormProps> = ({ auth, onUpdate, onPlacementUpdate, canUseBodyPlacement }) => {
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
              <SelectItem value="body" disabled={!canUseBodyPlacement}>
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

type OAuth2AuthFormProps = {
  auth: Partial<OAuth2Auth>
  onUpdate: (updates: Record<string, unknown>) => void
  onDiscover: () => void
  onFetch: () => void
}

const OAuth2AuthForm: FC<OAuth2AuthFormProps> = ({ auth, onUpdate, onDiscover, onFetch }) => {
  const { activeRequest } = useApplication(
    useShallow((state) => {
      const active = state.requestTabsState.activeTab
      return { activeRequest: active ? state.requestTabsState.openTabs[active]?.merged : undefined }
    }),
  )

  // Track cached token for this request (session only; not persisted)
  const [cachedToken, setCachedToken] = React.useState<string>("")
  const [tokenType, setTokenType] = React.useState<string>("")
  const [expiresAtSec, setExpiresAtSec] = React.useState<number | undefined>(undefined)
  const cacheKey = React.useMemo(
    () => (activeRequest ? `request-auth-${activeRequest.id}` : undefined),
    [activeRequest],
  )

  // Observe cache entry changes and resolve to plaintext token for display
  const _cacheEntry = useApplication((state) => (cacheKey ? state.credentialsCacheState.cache[cacheKey] : undefined))

  // Re-run when the cache entry changes so the UI reflects freshly fetched tokens
  // biome-ignore lint/correctness/useExhaustiveDependencies: We intentionally depend on _cacheEntry to refresh token display
  React.useEffect(() => {
    if (!cacheKey) {
      setCachedToken("")
      return
    }
    ;(async () => {
      try {
        const result = await credentialsCacheApi().get(cacheKey)
        if (!result) {
          setCachedToken("")
          return
        }
        // Try to extract token from Authorization header: "<type> <token>"
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
      } catch (_e) {
        setTokenType("")
        setCachedToken("")
      }
    })()
  }, [cacheKey, _cacheEntry])

  const handleDeleteToken = React.useCallback(() => {
    if (cacheKey) {
      credentialsCacheApi().remove(cacheKey)
      setCachedToken("")
      setTokenType("")
      setExpiresAtSec(undefined)
    }
  }, [cacheKey])

  // token meta is presented directly in the shared editor

  return (
    <OAuth2Editor
      auth={auth}
      onUpdate={onUpdate}
      onDiscover={onDiscover}
      token={{ value: cachedToken, type: tokenType, expiresAtSec, onFetch, onDelete: handleDeleteToken }}
    />
  )
}

// --- Main Panel Component ---

export function RequestAuthPanel({ tabId }: RequestAuthPanelProps) {
  const requestTab = useRequestTab(tabId)
  const {
    actions: { collectionsApi: getCollectionsApi },
  } = useCollections()
  const request = requestTab?.state.request
  const requestTabsApi = requestTab?.actions.requestTabsApi
  // Read parent auth for inheritance checks; keep hooks at top-level
  const parentAuth = useApplication((state) =>
    request ? state.collectionsState.cache[request.collectionId]?.authentication : undefined,
  )

  if (!request || !requestTab || !requestTabsApi) {
    return null
  }

  const { authentication } = request
  const authType = authentication?.type ?? "none"

  const handleInputChange = (updates: Record<string, unknown>) => {
    if (authType === "none" || authType === "inherit") {
      return
    }
    getCollectionsApi().updateRequestPatch(request.collectionId, request.id, {
      authentication: {
        type: authType,
        [authType]: {
          ...(authentication[authType] ?? {}),
          ...updates,
        },
      },
    })
  }

  const handlePlacementChange = (updates: Record<string, unknown>) => {
    if (authentication.type !== "apiKey" && authentication.type !== "bearer") {
      return
    }
    const current = authentication[authentication.type] ?? {}
    getCollectionsApi().updateRequestPatch(request.collectionId, request.id, {
      authentication: {
        type: authentication.type,
        [authentication.type]: {
          ...current,
          placement: { ...(current.placement ?? {}), ...updates },
        },
      },
    })
  }

  const handleDiscover = async () => {
    if (authentication.type !== "oauth2") {
      return
    }
    const oauth2 = authentication.oauth2 ?? {}
    const discoveryBase = oauth2.discoveryUrl || oauth2.authUrl
    if (!discoveryBase) {
      return
    }
    try {
      const normalized = discoveryBase.replace(/\/$/, "")
      const url = /\.well-known\//.test(normalized) ? normalized : `${normalized}/.well-known/openid-configuration`
      const result = await discoverOidc(url)
      handleInputChange({
        authUrl: result.authorizationEndpoint,
        tokenUrl: result.tokenEndpoint,
      })
    } catch (error) {
      console.error("OIDC Discovery failed:", error)
    }
  }

  const canUseBodyPlacement = (() => {
    const b = request.body
    return b?.type === "form" && ((b.encoding ?? "url") === "url" || b.encoding === "multipart")
  })()

  // Warn when inheriting a collection-level body placement but request body cannot carry it
  const inheritedBodyPlacementConflict =
    authentication.type === "inherit" &&
    parentAuth &&
    (parentAuth.type === "bearer" || parentAuth.type === "apiKey") &&
    parentAuth[parentAuth.type]?.placement?.type === "body" &&
    !canUseBodyPlacement

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
            canUseBodyPlacement={canUseBodyPlacement}
          />
        )
      case "apiKey":
        return (
          <ApiKeyAuthForm
            auth={authentication.apiKey ?? {}}
            onUpdate={handleInputChange}
            onPlacementUpdate={handlePlacementChange}
            canUseBodyPlacement={canUseBodyPlacement}
          />
        )
      case "oauth2": {
        return (
          <OAuth2AuthForm
            auth={authentication.oauth2 ?? {}}
            onUpdate={handleInputChange}
            onDiscover={handleDiscover}
            onFetch={() => requestTabsApi.runAuthOnly(tabId)}
          />
        )
      }
      default:
        return (
          <div className="flex h-32 items-center justify-center">
            <p className="text-muted-foreground">
              {authType === "inherit"
                ? "This request inherits authentication from its parent."
                : "No authentication is required for this request."}
            </p>
          </div>
        )
    }
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto p-2 text-sm">
      <div className="flex flex-col gap-3">
        <SectionHeader title="Authentication">
          <span className="text-xs text-muted-foreground/80">{AuthTypes[authType]}</span>
        </SectionHeader>

        {inheritedBodyPlacementConflict && (
          <Alert>
            <AlertDescription>
              This request inherits authentication that uses Body placement, but the current body is not a Form with
              URL-encoded or Multipart encoding. Update the request body or change the inherited placement.
            </AlertDescription>
          </Alert>
        )}

        <div>{renderAuthForm()}</div>
      </div>
    </div>
  )
}
