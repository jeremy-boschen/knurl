import React, { type FC } from "react"

import type { AuthConfig as BindingAuthConfig } from "@/bindings/knurl"
import { discoverOidc, getAuthenticationResult } from "@/bindings/knurl"
import { OAuth2Editor } from "@/components/auth/oauth2-editor"
import { ApiKeyAuthForm, BasicAuthForm, BearerAuthForm } from "@/components/auth/auth-forms"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createDefaultAuthConfig } from "@/lib"
import { credentialsCacheApi, useCollection, useCredentialsCacheEntry } from "@/state"
import type { Collection } from "@/types"
import type { OAuth2Auth } from "@/types/request"
import { type AuthType, AuthTypes } from "@/types/request"

import { getSyncLogger } from "@/lib/logger"

const logger = getSyncLogger("components/utility-sheets/collection-settings/collection-auth-panel")

type Props = {
  collectionId: string
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
  const {
    state: { cacheEntry: _cacheEntry },
  } = useCredentialsCacheEntry(cacheKey)

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
              deviceAuthorizationUrl: auth.deviceAuthorizationUrl,
              discoveryUrl: auth.discoveryUrl,
              clientId: auth.clientId,
              clientSecret: auth.clientSecret,
              scope: auth.scope,
              refreshToken: auth.refreshToken,
              redirectUri: auth.redirectUri,
              usePkce: auth.usePkce ?? true,
              tokenCaching: auth.tokenCaching ?? "always",
              clientAuth: auth.clientAuth ?? "body",
              tokenExtraParams: auth.tokenExtraParams,
            }
            const result = await getAuthenticationResult(binding, `collection-auth-${collectionId}`)
            await credentialsCacheApi().set(cacheKey, result)
          } catch (e) {
            logger.error("Collection OAuth2 fetch failed:", { e })
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
    const base = createDefaultAuthConfig(value)
    void collectionsApi().updateCollection(collection.id, { authentication: base } as Partial<Collection>)
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
    void collectionsApi().updateCollection(collection.id, next as Partial<Collection>)
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
    void collectionsApi().updateCollection(collection.id, next as Partial<Collection>)
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
      handleInputChange({
        authUrl: result.authorizationEndpoint,
        tokenUrl: result.tokenEndpoint,
        deviceAuthorizationUrl: result.deviceAuthorizationEndpoint,
      })
    } catch (err) {
      logger.error("OIDC Discovery failed:", { err })
    }
  }

  const renderAuthForm = () => {
    switch (authentication.type) {
      case "basic":
        return (
          <BasicAuthForm
            auth={authentication.basic ?? {}}
            onUpdate={handleInputChange}
            testIdPrefix="collection-auth"
          />
        )
      case "bearer":
        return (
          <BearerAuthForm
            auth={authentication.bearer ?? {}}
            onUpdate={handleInputChange}
            onPlacementUpdate={handlePlacementChange}
            testIdPrefix="collection-auth"
          />
        )
      case "apiKey":
        return (
          <ApiKeyAuthForm
            auth={authentication.apiKey ?? {}}
            onUpdate={handleInputChange}
            onPlacementUpdate={handlePlacementChange}
            testIdPrefix="collection-auth"
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
        <Select value={authType} onValueChange={(v) => handleAuthTypeChange(v as AuthType)}>
          <SelectTrigger className="w-48" data-test-id="collection-auth:type-trigger">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            {typeLabels.map(([type, name]) => (
              <SelectItem key={type} value={type} data-test-id={`collection-auth:type-${type}`}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="pt-2">{renderAuthForm()}</div>
    </div>
  )
}
