import React, { type FC } from "react"

import { discoverOidc } from "@/bindings/knurl"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { OAuth2Editor } from "@/components/auth/oauth2-editor"
import { ApiKeyAuthForm, BasicAuthForm, BearerAuthForm } from "@/components/auth/auth-forms"
import { SectionHeader } from "./section-header"
import { credentialsCacheApi } from "@/state/application"
import { useCollections, useCollectionFromCache, useCredentialsCacheEntry, useRequestTab } from "@/state"
import type { ApiKeyAuth, AuthConfig, AuthType, BasicAuth, BearerAuth, OAuth2Auth } from "@/types/request"
import { AuthTypes } from "@/types/request"

export type RequestAuthPanelProps = {
  tabId: string
}

// --- Auth Type Forms ---

type OAuth2AuthFormProps = {
  requestId: string
  auth: Partial<OAuth2Auth>
  onUpdate: (updates: Record<string, unknown>) => void
  onDiscover: () => void
  onFetch: () => void
}

const OAuth2AuthForm: FC<OAuth2AuthFormProps> = ({ requestId, auth, onUpdate, onDiscover, onFetch }) => {
  // Track cached token for this request (session only; not persisted)
  const [cachedToken, setCachedToken] = React.useState<string>("")
  const [tokenType, setTokenType] = React.useState<string>("")
  const [expiresAtSec, setExpiresAtSec] = React.useState<number | undefined>(undefined)
  const cacheKey = React.useMemo(() => `request-auth-${requestId}`, [requestId])

  // Observe cache entry changes and resolve to plaintext token for display
  const {
    state: { cacheEntry: _cacheEntry },
  } = useCredentialsCacheEntry(cacheKey)

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
  const {
    state: { collection },
  } = useCollectionFromCache(request?.collectionId ?? "")
  const parentAuth = collection?.authentication
  const [discoveryError, setDiscoveryError] = React.useState<string | null>(null)

  if (!request || !requestTab || !requestTabsApi) {
    return null
  }

  const { authentication } = request
  const authType = authentication?.type ?? "none"

  const setAuthentication = (config: AuthConfig) => {
    getCollectionsApi().setRequestAuthentication(request.collectionId, request.id, config)
  }

  const updateAuthenticationForType = (
    type: AuthType,
    updater: (
      current: BasicAuth | BearerAuth | ApiKeyAuth | OAuth2Auth,
    ) => BasicAuth | BearerAuth | ApiKeyAuth | OAuth2Auth,
  ) => {
    switch (type) {
      case "basic": {
        const current = authentication.basic ?? {}
        setAuthentication({ type: "basic", basic: updater(current as BasicAuth) as BasicAuth })
        break
      }
      case "bearer": {
        const current = authentication.bearer ?? {}
        setAuthentication({ type: "bearer", bearer: updater(current as BearerAuth) as BearerAuth })
        break
      }
      case "apiKey": {
        const current = authentication.apiKey ?? {}
        setAuthentication({ type: "apiKey", apiKey: updater(current as ApiKeyAuth) as ApiKeyAuth })
        break
      }
      case "oauth2": {
        const current = authentication.oauth2 ?? {
          grantType: "client_credentials",
          tokenCaching: "always",
          clientAuth: "body",
        }
        setAuthentication({ type: "oauth2", oauth2: updater(current as OAuth2Auth) as OAuth2Auth })
        break
      }
      default:
        break
    }
  }

  const handleInputChange = (updates: Record<string, unknown>) => {
    if (authType === "none" || authType === "inherit") {
      return
    }
    updateAuthenticationForType(
      authType,
      (current) =>
        ({
          ...(current ?? {}),
          ...updates,
        }) as BasicAuth | BearerAuth | ApiKeyAuth | OAuth2Auth,
    )
  }

  const handlePlacementChange = (updates: Record<string, unknown>) => {
    if (authentication.type !== "apiKey" && authentication.type !== "bearer") {
      return
    }
    updateAuthenticationForType(
      authentication.type,
      (current) =>
        ({
          ...(current ?? {}),
          placement: { ...((current as BearerAuth | ApiKeyAuth).placement ?? {}), ...updates },
        }) as BearerAuth | ApiKeyAuth,
    )
  }

  const handleDiscover = async () => {
    if (authentication.type !== "oauth2") {
      return
    }
    const oauth2 = authentication.oauth2 ?? {}
    const discoveryBase = oauth2.discoveryUrl || oauth2.authUrl
    if (!discoveryBase) {
      setDiscoveryError("Please enter a Discovery URL or Auth URL before attempting auto-discovery")
      return
    }
    try {
      setDiscoveryError(null)
      const normalized = discoveryBase.replace(/\/$/, "")
      const url = /\.well-known\//.test(normalized) ? normalized : `${normalized}/.well-known/openid-configuration`
      const result = await discoverOidc(url)
      // Only update fields if discovery was successful - no updates happen on error
      handleInputChange({
        authUrl: result.authorizationEndpoint,
        tokenUrl: result.tokenEndpoint,
        deviceAuthorizationUrl: result.deviceAuthorizationEndpoint,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error("OIDC Discovery failed:", error)
      // Show error alert to user - existing fields remain unchanged
      setDiscoveryError(`Auto-discovery failed: ${errorMessage}`)
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
        return (
          <BasicAuthForm
            auth={authentication.basic ?? {}}
            onUpdate={handleInputChange}
            testIdPrefix="request-auth-panel"
          />
        )
      case "bearer":
        return (
          <BearerAuthForm
            auth={authentication.bearer ?? {}}
            onUpdate={handleInputChange}
            onPlacementUpdate={handlePlacementChange}
            canUseBodyPlacement={canUseBodyPlacement}
            testIdPrefix="request-auth-panel"
          />
        )
      case "apiKey":
        return (
          <ApiKeyAuthForm
            auth={authentication.apiKey ?? {}}
            onUpdate={handleInputChange}
            onPlacementUpdate={handlePlacementChange}
            canUseBodyPlacement={canUseBodyPlacement}
            testIdPrefix="request-auth-panel"
          />
        )
      case "oauth2": {
        return (
          <OAuth2AuthForm
            requestId={request.id}
            auth={authentication.oauth2 ?? {}}
            onUpdate={handleInputChange}
            onDiscover={handleDiscover}
            onFetch={() => requestTabsApi.runAuthOnly(tabId)}
          />
        )
      }
      default:
        return (
          <div className="flex h-32 items-center justify-center" data-test-id="request-auth-panel:no-auth-message">
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
    <div className="h-full min-h-0 overflow-y-auto p-2 text-sm" data-test-id="request-auth-panel">
      <div className="flex flex-col gap-3">
        <SectionHeader title="Authentication">
          <span className="text-xs text-muted-foreground/80">{AuthTypes[authType]}</span>
        </SectionHeader>

        {inheritedBodyPlacementConflict && (
          <Alert data-test-id="request-auth-panel:body-placement-conflict-alert">
            <AlertDescription>
              This request inherits authentication that uses Body placement, but the current body is not a Form with
              URL-encoded or Multipart encoding. Update the request body or change the inherited placement.
            </AlertDescription>
          </Alert>
        )}

        {discoveryError && (
          <Alert variant="destructive" data-test-id="request-auth-panel:discovery-error-alert">
            <AlertTitle>Discovery Error</AlertTitle>
            <AlertDescription>{discoveryError}</AlertDescription>
          </Alert>
        )}

        <div>{renderAuthForm()}</div>
      </div>
    </div>
  )
}
