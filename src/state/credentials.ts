import type { StateCreator } from "zustand"

import type { ApplicationState } from "@/types"

// This is a placeholder for the actual result from the backend
// It will be defined in more detail later.
export type AuthResult = {
  headers?: Record<string, string>
  query?: Record<string, string>
  cookies?: Record<string, string>
  body?: Record<string, unknown>
  expiresAt?: number // unix timestamp
}

export type CredentialsCacheState = {
  cache: Record<string, string> // Store encrypted AuthResult
  key: CryptoKey | null
}

export type CredentialsCacheStateSlice = {
  credentialsCacheState: CredentialsCacheState
  credentialsCacheApi: CredentialsCacheStateApi
}

export type CredentialsCacheStateApi = {
  set: (key: string, result: AuthResult) => Promise<void>
  get: (key: string) => Promise<AuthResult | undefined>
  remove: (key: string) => void
  clear: () => void
  generateCacheKey: (requestId: string) => string
  generateCollectionCacheKey: (collectionId: string) => string
}

async function getKey(
  get: () => CredentialsCacheStateSlice,
  set: (fn: (state: CredentialsCacheStateSlice) => void) => void,
): Promise<CryptoKey> {
  let key = get().credentialsCacheState.key
  if (!key) {
    key = await window.crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256,
      },
      true,
      ["encrypt", "decrypt"],
    )
    set((state) => {
      state.credentialsCacheState.key = key
    })
  }
  return key
}

async function encrypt(key: CryptoKey, data: AuthResult): Promise<string> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const encodedData = new TextEncoder().encode(JSON.stringify(data))
  const encryptedContent = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encodedData,
  )

  const buffer = new Uint8Array(iv.byteLength + encryptedContent.byteLength)
  buffer.set(iv, 0)
  buffer.set(new Uint8Array(encryptedContent), iv.byteLength)
  return btoa(String.fromCharCode.apply(null, Array.from(buffer)))
}

async function decrypt(key: CryptoKey, encryptedData: string): Promise<AuthResult> {
  const encryptedBuffer = new Uint8Array(
    atob(encryptedData)
      .split("")
      .map((char) => char.charCodeAt(0)),
  )
  const iv = encryptedBuffer.slice(0, 12)
  const encryptedContent = encryptedBuffer.slice(12)

  const decryptedContent = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encryptedContent,
  )

  return JSON.parse(new TextDecoder().decode(decryptedContent))
}

export const createCredentialsCacheSlice: StateCreator<
  ApplicationState,
  [["storageManager", never], ["zustand/immer", never], ["zustand/subscribeWithSelector", never]],
  [],
  CredentialsCacheStateSlice
> = (set, get) => ({
  credentialsCacheState: {
    cache: {},
    key: null,
  },
  credentialsCacheApi: {
    set: async (key: string, result: AuthResult) => {
      const cryptoKey = await getKey(get, set)
      const encryptedResult = await encrypt(cryptoKey, result)
      set((state) => {
        state.credentialsCacheState.cache[key] = encryptedResult
      })
    },
    get: async (key: string) => {
      const encryptedEntry = get().credentialsCacheState.cache[key]
      if (!encryptedEntry) {
        return undefined
      }

      const cryptoKey = await getKey(get, set)
      const entry = await decrypt(cryptoKey, encryptedEntry)

      if (entry.expiresAt && entry.expiresAt < Date.now() / 1000) {
        // Entry has expired
        set((state) => {
          delete state.credentialsCacheState.cache[key]
        })
        return undefined
      }
      return entry
    },
    remove: (key: string) => {
      set((state) => {
        delete state.credentialsCacheState.cache[key]
      })
    },
    clear: () => {
      set((state) => {
        state.credentialsCacheState.cache = {}
      })
    },
    generateCacheKey: (requestId: string) => {
      return `request-auth-${requestId}`
    },
    generateCollectionCacheKey: (collectionId: string) => {
      return `collection-auth-${collectionId}`
    },
  },
})
