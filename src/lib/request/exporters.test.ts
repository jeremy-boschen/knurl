import {describe, expect, it} from "vitest"

import {buildExportCommand} from "@/lib/request/exporters"
import type {Collection, CredentialsCacheApi, RequestState} from "@/types"

const mockCredentialsCacheApi: CredentialsCacheApi = {
  async set() {
    throw new Error("not implemented")
  },
  async get() {
    return undefined
  },
  remove() {
  },
  clear() {
  },
  generateCacheKey(requestId: string) {
    return `request-auth-${requestId}`
  },
  generateCollectionCacheKey(collectionId: string) {
    return `collection-auth-${collectionId}`
  },
}

const baseRequest = (): RequestState => ({
  id: "req-1",
  folderId: "root",
  order: 0,
  name: "Example",
  collectionId: "col-1",
  environmentId: undefined,
  autoSave: false,
  method: "GET",
  url: "https://api.example.com/users",
  pathParams: {},
  queryParams: {},
  headers: {},
  cookieParams: {},
  body: {
    type: "none",
  },
  authentication: {
    type: "basic",
    basic: {
      username: "demo",
      password: "secret",
    },
  },
  tests: undefined,
  options: {},
  patch: {},
  updated: new Date().toISOString(),
})

const baseCollection = (): Collection => ({
  id: "col-1",
  name: "Collection",
  description: undefined,
  updated: new Date().toISOString(),
  encryption: {algorithm: "aes-gcm", key: undefined},
  activeEnvironmentId: undefined,
  environments: {},
  requests: {},
  folders: {},
  authentication: {type: "none"},
})

describe("buildExportCommand", () => {
  it("builds a curl command including basic auth header", async () => {
    const request = baseRequest()
    request.headers = {
      "header-1": {
        id: "h1",
        name: "Accept",
        value: "application/json",
        enabled: true,
        secure: false,
      },
    }
    request.options = {
      userAgent: "Knurl/1.0",
    }
    const cmd = await buildExportCommand("curl", {
      request,
      collection: baseCollection(),
      credentialsCacheApi: mockCredentialsCacheApi,
    })
    expect(cmd).toContain("curl")
    expect(cmd).toContain("-X 'GET'")
    expect(cmd).toContain("'https://api.example.com/users'")
    expect(cmd).toContain("-H 'Accept: application/json'")
    expect(cmd).toContain("-A 'Knurl/1.0'")
    expect(cmd).toContain("Authorization: Basic")
  })

  it("builds a fetch snippet with headers", async () => {
    const request = baseRequest()
    request.method = "POST"
    request.body = {
      type: "text",
      content: '{"name":"alice"}',
    }

    request.options = {
      disableSsl: true,
      timeoutSecs: 12,
      hostOverride: "api.alt.example.com:443:127.0.0.1",
      userAgent: "Knurl/1.0",
    }

    const snippet = await buildExportCommand("fetch", {
      request,
      collection: baseCollection(),
      credentialsCacheApi: mockCredentialsCacheApi,
    })

    expect(snippet).toContain(`fetch("https://api.example.com/users", {`)
    expect(snippet).toContain(`method: "POST"`)
    expect(snippet).toContain(`body: "{\\"name\\":\\"alice\\"}"`)
    expect(snippet).toContain(`"User-Agent": "Knurl/1.0"`)
    expect(snippet).toContain("// Additional client options to mirror:")
    expect(snippet).toContain("disable certificate verification")
    expect(snippet).toContain("map api.alt.example.com:443 to 127.0.0.1")
  })

  it("adds request options to curl and wget exports", async () => {
    const request = baseRequest()
    request.method = "PUT"
    request.options = {
      disableSsl: true,
      caPath: "/etc/custom.pem",
      timeoutSecs: 30,
      userAgent: "Knurl/2.0",
      httpVersion: "http2",
      maxRedirects: 4,
      hostOverride: "alt.example.com:8443:10.0.0.1",
    }

    const curlCmd = await buildExportCommand("curl", {
      request,
      collection: baseCollection(),
      credentialsCacheApi: mockCredentialsCacheApi,
    })

    expect(curlCmd).toContain("--insecure")
    expect(curlCmd).toContain("--cacert '/etc/custom.pem'")
    expect(curlCmd).toContain("--max-time '30'")
    expect(curlCmd).toContain("-A 'Knurl/2.0'")
    expect(curlCmd).toContain("--http2")
    expect(curlCmd).toContain("--max-redirs '4'")
    expect(curlCmd).toContain("--resolve 'alt.example.com:8443:10.0.0.1'")

    const wgetCmd = await buildExportCommand("wget", {
      request,
      collection: baseCollection(),
      credentialsCacheApi: mockCredentialsCacheApi,
    })

    expect(wgetCmd).toContain("--no-check-certificate")
    expect(wgetCmd).toContain("--ca-certificate='/etc/custom.pem'")
    expect(wgetCmd).toContain("--timeout='30'")
    expect(wgetCmd).toContain("--max-redirect='4'")
    expect(wgetCmd).toContain("--user-agent='Knurl/2.0'")
    expect(wgetCmd).toContain("--resolve='alt.example.com:8443:10.0.0.1'")
  })

  it("appends bearer query tokens to export URLs", async () => {
    const request = baseRequest()
    request.authentication = {
      type: "bearer",
      bearer: {
        token: "abc123",
        placement: {type: "query", name: "auth_token"},
      },
    }

    const cmd = await buildExportCommand("curl", {
      request,
      collection: baseCollection(),
      credentialsCacheApi: mockCredentialsCacheApi,
    })

    expect(cmd).toMatch(/auth_token=abc123/)
  })

  it("injects bearer cookies into export headers", async () => {
    const request = baseRequest()
    request.authentication = {
      type: "bearer",
      bearer: {
        token: "cookie-token",
        placement: {type: "cookie", name: "auth"},
      },
    }

    const cmd = await buildExportCommand("curl", {
      request,
      collection: baseCollection(),
      credentialsCacheApi: mockCredentialsCacheApi,
    })

    expect(cmd).toMatch(/Cookie: auth=cookie-token/)
  })

  it("embeds API key values into form bodies", async () => {
    const request = baseRequest()
    request.method = "POST"
    request.body = {
      type: "form",
      encoding: "url",
      formData: {},
    }
    request.authentication = {
      type: "apiKey",
      apiKey: {
        key: "api_key",
        value: "xyz",
        placement: {type: "body"},
      },
    }

    const snippet = await buildExportCommand("fetch", {
      request,
      collection: baseCollection(),
      credentialsCacheApi: mockCredentialsCacheApi,
    })

    expect(snippet).toContain('body: "api_key=xyz"')
  })

  it("uses cached oauth tokens from credentials storage", async () => {
    const request = baseRequest()
    request.authentication = {type: "oauth2"}
    const cachedAuth = {
      headers: {Authorization: "Bearer cached-token"},
    }
    const credentialsCacheApi: CredentialsCacheApi = {
      ...mockCredentialsCacheApi,
      async get() {
        return cachedAuth
      },
    }

    const cmd = await buildExportCommand("curl", {
      request,
      collection: baseCollection(),
      credentialsCacheApi,
    })

    expect(cmd).toContain("Authorization: Bearer cached-token")
  })

  it("includes binary payload references in curl exports", async () => {
    const request = baseRequest()
    request.method = "POST"
    request.body = {
      type: "binary",
      binaryPath: "/tmp/archive.bin",
      binaryContentType: "application/octet-stream",
    }

    const cmd = await buildExportCommand("curl", {
      request,
      collection: baseCollection(),
      credentialsCacheApi: mockCredentialsCacheApi,
    })

    expect(cmd).toContain("--data-binary '@/tmp/archive.bin'")
    expect(cmd).toContain("Content-Type: application/octet-stream")
  })

  it("adds guidance for binary payloads in fetch snippets", async () => {
    const request = baseRequest()
    request.method = "POST"
    request.body = {
      type: "binary",
      binaryPath: "/tmp/archive.bin",
    }

    const snippet = await buildExportCommand("fetch", {
      request,
      collection: baseCollection(),
      credentialsCacheApi: mockCredentialsCacheApi,
    })

    expect(snippet).toContain("// TODO: Replace with ArrayBuffer or Blob")
  })

  it("rejects multipart exports for wget", async () => {
    const request = baseRequest()
    request.method = "POST"
    request.body = {
      type: "form",
      encoding: "multipart",
      formData: {
        file: {
          id: "f1",
          key: "upload",
          value: "ignored",
          enabled: true,
          secure: false,
          kind: "file",
          filePath: "/tmp/data.txt",
        } as any,
      },
    }

    await expect(
      buildExportCommand("wget", {
        request,
        collection: baseCollection(),
        credentialsCacheApi: mockCredentialsCacheApi,
      }),
    ).rejects.toThrow(/multipart/)
  })
})
