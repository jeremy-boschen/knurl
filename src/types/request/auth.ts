import { z } from "zod"

/**
 * Schema defining authentication types
 */
export const zAuthType = z.enum(["none", "inherit", "bearer", "basic", "apiKey", "oauth2"])
export type AuthType = z.infer<typeof zAuthType>

export const zAuthTypes = z.record(zAuthType, z.string())

export const AuthTypes: z.infer<typeof zAuthTypes> = {
  none: "None",
  inherit: "Inherit",
  bearer: "Bearer",
  basic: "Basic",
  apiKey: "API Key",
  oauth2: "OAuth2",
}

/**
 * Where to place token/credentials when injecting auth
 */
export const zAuthPlacementType = z.enum(["header", "query", "cookie", "body"])
export type AuthPlacementType = z.infer<typeof zAuthPlacementType>

export const zAuthPlacement = z.discriminatedUnion("type", [
  // Default header name to Authorization if missing
  z.object({ type: z.literal("header"), name: z.string().default("Authorization") }),
  // Default names to empty string for query/cookie when missing
  z.object({ type: z.literal("query"), name: z.string().default("") }),
  z.object({ type: z.literal("cookie"), name: z.string().default("") }),
  // Default body fields to empty strings when missing
  z.object({ type: z.literal("body"), fieldName: z.string().default(""), contentType: z.string().default("") }),
])

const zBasicAuth = z.object({
  username: z.string().optional(),
  password: z.string().optional(),
})
export type BasicAuth = z.infer<typeof zBasicAuth>

export const zBearerAuth = z.object({
  token: z.string().optional(),
  // Optional scheme for Authorization header (e.g., "Bearer", "JWT", or custom)
  scheme: z.string().optional(),
  placement: zAuthPlacement.default({ type: "header", name: "Authorization" }),
})
export type BearerAuth = z.infer<typeof zBearerAuth>

export const zApiKeyAuth = z.object({
  key: z.string().optional(),
  value: z.string().optional(),
  placement: zAuthPlacement.default({ type: "header", name: "" }),
})
export type ApiKeyAuth = z.infer<typeof zApiKeyAuth>

const zOauth2Auth = z.object({
  grantType: z
    .enum(["client_credentials", "password", "refresh_token", "authorization_code", "device_code"])
    .default("client_credentials"),
  // Optional OpenID Connect discovery endpoint (issuer base or full .well-known URL)
  discoveryUrl: z.string().optional(),
  authUrl: z.string().optional(),
  tokenUrl: z.string().optional(),
  deviceAuthorizationUrl: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  scope: z.string().optional(),
  // Present only for historical compatibility; ROPC is not supported at runtime
  username: z.string().optional(),
  password: z.string().optional(),
  refreshToken: z.string().optional(),
  redirectUri: z.string().optional(),
  usePkce: z.boolean().default(true).optional(),
  tokenCaching: z.enum(["always", "never"]).default("always").optional(),
  clientAuth: z.enum(["basic", "body"]).default("body").optional(),
  tokenExtraParams: z.record(z.string(), z.string()).optional(),
})
export type OAuth2Auth = z.infer<typeof zOauth2Auth>

export const zAuthConfig = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("inherit") }),
  z.object({ type: z.literal("basic"), basic: zBasicAuth }),
  z.object({ type: z.literal("bearer"), bearer: zBearerAuth }),
  z.object({ type: z.literal("apiKey"), apiKey: zApiKeyAuth }),
  z.object({ type: z.literal("oauth2"), oauth2: zOauth2Auth }),
])

export type AuthConfig = z.infer<typeof zAuthConfig>
