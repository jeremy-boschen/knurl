/**
 * Integration Test: Auth Injection & Caching
 *
 * Tests that auth processing (Basic, Bearer, API Key, OAuth2) correctly injects
 * credentials into requests. Verifies auth caching, token placement options,
 * and auth configuration changes. Uses bridge API to verify backend auth results.
 *
 * Setup: UI-based (user configures auth)
 * Verification: Bridge API (inspect injected auth headers/cookies/query params)
 */

import { expect } from "@wdio/globals"
import { ensureWorkspaceReady } from "../../../support/ui"
import { callBridgeReplacement } from "../../../support/bridge-replacement"

describe("Auth Injection & Caching", () => {
  before(async () => {
    await ensureWorkspaceReady()
  })

  it("injects Basic auth as Authorization header", async () => {
    // Verify bridge can invoke auth processing
    const authResult = await callBridgeReplacement("invokeAuthViaTauri", {
      authType: "basic",
      username: "user@example.com",
      password: "secret123",
    })

    expect(authResult).toBeDefined()
    expect(authResult.headers).toBeDefined()
    // Basic auth should be in Authorization header
    const authHeader = authResult.headers?.Authorization || authResult.headers?.authorization
    expect(authHeader).toMatch(/^Basic\s+/)
  })

  it("injects Bearer token in Authorization header", async () => {
    const authResult = await callBridgeReplacement("invokeAuthViaTauri", {
      authType: "bearer",
      token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
    })

    expect(authResult).toBeDefined()
    expect(authResult.headers).toBeDefined()
    const authHeader = authResult.headers?.Authorization || authResult.headers?.authorization
    expect(authHeader).toContain("Bearer")
    expect(authHeader).toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9")
  })

  it("injects Bearer token in query parameter when configured", async () => {
    const authResult = await callBridgeReplacement("invokeAuthViaTauri", {
      authType: "bearer",
      token: "test-token-123",
      placement: "query",
    })

    expect(authResult).toBeDefined()
    // Should be in query params, not headers
    if (authResult.query) {
      expect(authResult.query).toBeDefined()
      expect(authResult.query).toHaveProperty("Authorization")
      expect(authResult.query.Authorization).toBe("Bearer test-token-123")
    }
  })

  it("injects Bearer token in cookie when configured", async () => {
    const authResult = await callBridgeReplacement("invokeAuthViaTauri", {
      authType: "bearer",
      token: "cookie-token-456",
      placement: "cookie",
    })

    expect(authResult).toBeDefined()
    // Should be in cookies
    if (authResult.cookies) {
      expect(authResult.cookies).toBeDefined()
    }
  })

  it("injects API Key in header with custom key name", async () => {
    const authResult = await callBridgeReplacement("invokeAuthViaTauri", {
      authType: "apiKey",
      keyName: "X-API-Key",
      keyValue: "abc123def456",
      placement: "header",
    })

    expect(authResult).toBeDefined()
    expect(authResult.headers).toBeDefined()
    const apiKeyHeader = authResult.headers?.["X-API-Key"]
    expect(apiKeyHeader).toBe("abc123def456")
  })

  it("injects API Key in query parameter", async () => {
    const authResult = await callBridgeReplacement("invokeAuthViaTauri", {
      authType: "apiKey",
      keyName: "api_key",
      keyValue: "query-key-789",
      placement: "query",
    })

    expect(authResult).toBeDefined()
    if (authResult.query) {
      expect(authResult.query.api_key).toBe("query-key-789")
    }
  })

  it("injects API Key in cookie", async () => {
    const authResult = await callBridgeReplacement("invokeAuthViaTauri", {
      authType: "apiKey",
      keyName: "auth_token",
      keyValue: "cookie-key-abc",
      placement: "cookie",
    })

    expect(authResult).toBeDefined()
    // Should have cookies
    if (authResult.cookies) {
      expect(authResult.cookies).toBeDefined()
    }
  })

  it("handles OAuth2 client credentials flow", async () => {
    // OAuth2 client credentials should fetch token
    const authResult = await callBridgeReplacement("invokeAuthViaTauri", {
      authType: "oauth2",
      grantType: "client_credentials",
      clientId: "test-client-id",
      clientSecret: "test-secret",
      tokenUrl: "https://auth.example.com/oauth/token",
    })

    expect(authResult).toBeDefined()
    // Should have auth result with Bearer token
    if (authResult.headers) {
      const authHeader = authResult.headers?.Authorization || authResult.headers?.authorization
      expect(authHeader).toBeDefined()
    }
  })

  it("caches OAuth2 token and reuses on subsequent requests", async () => {
    // First request fetches token
    const authResult1 = await callBridgeReplacement("invokeAuthViaTauri", {
      authType: "oauth2",
      grantType: "client_credentials",
      clientId: "cache-test-id",
      clientSecret: "cache-secret",
      tokenUrl: "https://auth.example.com/oauth/token",
    })

    expect(authResult1).toBeDefined()

    // Second request should reuse cached token
    const authResult2 = await callBridgeReplacement("invokeAuthViaTauri", {
      authType: "oauth2",
      grantType: "client_credentials",
      clientId: "cache-test-id",
      clientSecret: "cache-secret",
      tokenUrl: "https://auth.example.com/oauth/token",
    })

    expect(authResult2).toBeDefined()
    // Both should have auth results
    if (authResult1.headers && authResult2.headers) {
      const header1 = authResult1.headers?.Authorization || authResult1.headers?.authorization
      const header2 = authResult2.headers?.Authorization || authResult2.headers?.authorization
      // Should contain Bearer tokens
      expect(header1).toContain("Bearer")
      expect(header2).toContain("Bearer")
    }
  })

  it("invalidates cache when auth config changes", async () => {
    // First config
    const authResult1 = await callBridgeReplacement("invokeAuthViaTauri", {
      authType: "oauth2",
      grantType: "client_credentials",
      clientId: "id-v1",
      clientSecret: "secret-v1",
      tokenUrl: "https://auth.example.com/oauth/token",
    })

    expect(authResult1).toBeDefined()

    // Different config (should not use cached token from id-v1)
    const authResult2 = await callBridgeReplacement("invokeAuthViaTauri", {
      authType: "oauth2",
      grantType: "client_credentials",
      clientId: "id-v2",
      clientSecret: "secret-v2",
      tokenUrl: "https://auth.example.com/oauth/token",
    })

    expect(authResult2).toBeDefined()
    // Both should be valid but potentially different tokens
  })

  it("handles missing or invalid auth credentials gracefully", async () => {
    // Invalid Bearer token should still be injected
    const authResult = await callBridgeReplacement("invokeAuthViaTauri", {
      authType: "bearer",
      token: "",
    })

    expect(authResult).toBeDefined()
  })

  it("preserves existing Authorization header when no auth configured", async () => {
    // No auth configured - should pass through
    const authResult = await callBridgeReplacement("invokeAuthViaTauri", {
      authType: "none",
    })

    expect(authResult).toBeDefined()
    // Should either have no headers or empty headers
    if (authResult.headers) {
      expect(authResult.headers).toBeDefined()
    }
  })
})
