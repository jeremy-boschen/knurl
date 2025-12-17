import { type AuthConfig as BindingAuthConfig, getAuthenticationResult } from "@/bindings/knurl"
import { resolveRequestVariables } from "@/lib/environments"
import { HttpEngine } from "@/request/http/engine"
import { WebSocketEngine } from "@/request/ws/engine"
import type { Application, AuthResult, Environment, LogEntry, RequestState, ResponseState } from "@/types"
import type { StoreApi } from "zustand"
import { logger } from "@/lib/logger"

/**
 * A mutable context object that is passed through the request pipeline.
 */
export type RequestContext = {
  request: RequestState
  environment?: Environment
  authResult?: AuthResult
  response: Partial<ResponseState>
  /** Unique correlation id for this pipeline run; used for log filtering and backend requestId */
  correlationId?: string
}

/**
 * Represents a single, asynchronous step in the request pipeline.
 */
export type RequestPhase = (context: RequestContext) => Promise<RequestContext>

/**
 * An interface for a protocol-specific execution module.
 */
export interface RequestEngine {
  execute: (context: RequestContext) => Promise<ResponseState>
}

/**
 * An interface for abstracting state updates.
 */
export interface PipelineNotifier {
  onStart: () => void
  onSuccess: (response: ResponseState) => void
  onError: (error: Error) => void
  onLog: (entry: LogEntry) => void
}

// --- CORE PHASES ---

export const resolveVariablesPhase: RequestPhase = async (context) => {
  context.request = resolveRequestVariables(context.request, context.environment)
  return context
}

export const createAuthPhase = (
  get: StoreApi<Application>["getState"],
  _set: StoreApi<Application>["setState"],
): RequestPhase => {
  return async (context) => {
    const { request } = context
    const state = get()
    const collection = state.collectionsApi.getCollection(request.collectionId)

    if (request.authentication.type === "inherit" && !collection) {
      const msg = `Cannot inherit authentication: collection "${request.collectionId}" not found`
      logger.error(`[AUTH] ${msg}`)
      throw new Error(msg)
    }

    const effectiveAuth =
      request.authentication.type === "inherit" ? collection?.authentication : request.authentication

    const toBindingAuth = (auth: typeof request.authentication): BindingAuthConfig => {
      switch (auth.type) {
        case "none":
          return { type: "none" }
        case "inherit":
          // Should never reach here due to validation above, but handle gracefully
          return { type: "none" }
        case "basic":
          return {
            type: "basic",
            username: auth.basic?.username,
            password: auth.basic?.password,
          }
        case "bearer":
          return {
            type: "bearer",
            token: auth.bearer?.token,
            scheme: auth.bearer?.scheme,
            placement: auth.bearer?.placement,
          }
        case "apiKey":
          return {
            type: "apiKey",
            key: auth.apiKey?.key,
            value: auth.apiKey?.value,
            placement: auth.apiKey?.placement,
          }
        case "oauth2": {
          const g = auth.oauth2?.grantType ?? "client_credentials"
          const cAuth = auth.oauth2?.clientAuth ?? "body"
          const caching = auth.oauth2?.tokenCaching ?? "always"
          return {
            type: "oauth2",
            grantType: g,
            discoveryUrl: auth.oauth2?.discoveryUrl,
            authUrl: auth.oauth2?.authUrl,
            tokenUrl: auth.oauth2?.tokenUrl,
            deviceAuthorizationUrl: auth.oauth2?.deviceAuthorizationUrl,
            clientId: auth.oauth2?.clientId,
            clientSecret: auth.oauth2?.clientSecret,
            scope: auth.oauth2?.scope,
            username: auth.oauth2?.username,
            password: auth.oauth2?.password,
            refreshToken: auth.oauth2?.refreshToken,
            redirectUri: auth.oauth2?.redirectUri,
            usePkce: auth.oauth2?.usePkce,
            tokenCaching: caching,
            clientAuth: cAuth,
            tokenExtraParams: auth.oauth2?.tokenExtraParams,
          }
        }
        default:
          return { type: "none" }
      }
    }

    if (effectiveAuth && effectiveAuth.type !== "none" && effectiveAuth.type !== "inherit") {
      const { credentialsCacheApi } = get()
      const cacheKey =
        request.authentication.type === "inherit"
          ? credentialsCacheApi.generateCollectionCacheKey(collection.id)
          : credentialsCacheApi.generateCacheKey(request.id)
      const caching: "always" | "never" | undefined =
        effectiveAuth.type === "oauth2" ? (effectiveAuth.oauth2?.tokenCaching ?? "always") : undefined

      let authResult: AuthResult | undefined
      if (caching === "never") {
        // Always refresh: fetch a new token and also update the cache
        authResult = await getAuthenticationResult(toBindingAuth(effectiveAuth), context.correlationId)
        await credentialsCacheApi.set(cacheKey, authResult)
      } else {
        authResult = await credentialsCacheApi.get(cacheKey)
        if (!authResult) {
          authResult = await getAuthenticationResult(toBindingAuth(effectiveAuth), context.correlationId)
          await credentialsCacheApi.set(cacheKey, authResult)
        }
      }
      context.authResult = authResult
    }

    return context
  }
}

const engineRegistry: Record<string, RequestEngine> = {
  http: HttpEngine,
  https: HttpEngine,
  ws: WebSocketEngine,
  wss: WebSocketEngine,
}

export const protocolDispatchPhase: RequestPhase = async (context) => {
  const url = new URL(context.request.url)
  const protocol = url.protocol.replace(":", "")
  const engine = engineRegistry[protocol]

  if (!engine) {
    const msg = `Unsupported protocol: ${protocol}`
    logger.error(`[PIPELINE] ${msg}`)
    throw new Error(msg)
  }

  context.response = await engine.execute(context)
  return context
}

/**
 * Executes a series of request phases in sequence.
 */
export const runPipeline = async (
  phases: RequestPhase[],
  initialContext: RequestContext,
  notifier: PipelineNotifier,
): Promise<void> => {
  notifier.onStart()
  try {
    let context = initialContext
    for (const phase of phases) {
      context = await phase(context)
    }
    notifier.onSuccess(context.response as ResponseState)
  } catch (error) {
    const err = error as Error
    logger.error(`[PIPELINE] Pipeline error: ${err.message}${err.stack ? `\nStack: ${err.stack}` : ""}`)
    notifier.onError(err)
  }
}
