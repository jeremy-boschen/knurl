import { describe, expect, it } from "vitest"

import { createDefaultAuthConfig } from "./auth"

describe("createDefaultAuthConfig", () => {
  it("returns canonical defaults for each auth type", () => {
    expect(createDefaultAuthConfig("none")).toEqual({ type: "none" })
    expect(createDefaultAuthConfig("inherit")).toEqual({ type: "inherit" })
    expect(createDefaultAuthConfig("basic")).toEqual({ type: "basic", basic: {} })
    expect(createDefaultAuthConfig("bearer")).toEqual({
      type: "bearer",
      bearer: { scheme: "Bearer", placement: { type: "header", name: "Authorization" } },
    })
    expect(createDefaultAuthConfig("apiKey")).toEqual({
      type: "apiKey",
      apiKey: { placement: { type: "header", name: "" } },
    })
    expect(createDefaultAuthConfig("oauth2")).toEqual({
      type: "oauth2",
      oauth2: { grantType: "client_credentials", tokenCaching: "always", clientAuth: "body" },
    })
  })

  it("falls back to none for unknown types", () => {
    expect(createDefaultAuthConfig("custom" as any)).toEqual({ type: "none" })
  })
})
