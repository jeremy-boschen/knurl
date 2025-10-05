import { describe, it, expect, beforeEach } from "vitest"
import { createStore } from "zustand"
import { immer } from "zustand/middleware/immer"
import { enableMapSet } from "immer"

import { createCredentialsCacheSlice, type CredentialsCacheStateSlice } from "./credentials"

enableMapSet()

const createTestStore = () =>
  createStore<CredentialsCacheStateSlice>()(
    immer((...args) => ({
      ...createCredentialsCacheSlice(...args),
    })),
  )

describe("CredentialsCache Slice", () => {
  let store: ReturnType<typeof createTestStore>

  beforeEach(() => {
    store = createTestStore()
  })

  it("should set and get a value from the cache", async () => {
    const { credentialsCacheApi } = store.getState()
    const key = "test-key"
    const value = { headers: { Authorization: "Bearer test-token" } }

    await credentialsCacheApi.set(key, value)
    const result = await credentialsCacheApi.get(key)

    expect(result).toEqual(value)
  })

  it("should return undefined for expired entries", async () => {
    const { credentialsCacheApi } = store.getState()
    const key = "expired-key"
    const value = {
      headers: { Authorization: "Bearer test-token" },
      expiresAt: Math.floor(Date.now() / 1000) - 60, // 1 minute in the past
    }

    await credentialsCacheApi.set(key, value)
    const result = await credentialsCacheApi.get(key)

    expect(result).toBeUndefined()
  })

  it("should clear the cache", async () => {
    const { credentialsCacheApi } = store.getState()
    const key = "test-key"
    const value = { headers: { Authorization: "Bearer test-token" } }

    await credentialsCacheApi.set(key, value)
    credentialsCacheApi.clear()
    const result = await credentialsCacheApi.get(key)

    expect(result).toBeUndefined()
  })

  it("should generate a cache key", () => {
    const { credentialsCacheApi } = store.getState()
    const requestId = "req-123"
    const key = credentialsCacheApi.generateCacheKey(requestId)
    expect(key).toBe("request-auth-req-123")
  })
})
