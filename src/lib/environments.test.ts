import { describe, it, expect } from "vitest"
import { resolveVariablesPhase, type RequestContext } from "@/request/pipeline"
import { resolveRequestVariables } from "./environments"
import type { Environment, RequestState } from "@/types"

function makeCtx(vars: Partial<Environment["variables"]>): RequestContext {
  return {
    request: {
      id: "r1",
      collectionId: "c1",
      name: "Req",
      method: "GET",
      url: "https://{{host}}/users/{{id}}",
      headers: {},
      queryParams: {},
      body: { type: "none" },
    } as RequestState,
    environment: {
      id: "e1",
      name: "env",
      variables: vars as Environment["variables"],
    } as Environment,
    response: {},
  }
}

describe("resolveVariablesPhase: disabled variables are ignored", () => {
  it("does not substitute values for disabled variables and leaves placeholders intact", async () => {
    const ctx = makeCtx({
      host: { id: "v1", name: "host", value: "api.example.com", secure: false, enabled: false },
      id: { id: "v2", name: "id", value: "123", secure: false, enabled: true },
    })

    const out = await resolveVariablesPhase(ctx)
    expect(out.request.url).toBe("https://{{host}}/users/123")
  })
})

describe("resolveRequestVariables", () => {
  it("substitutes variables across url, params, headers, and options", () => {
    const request = {
      url: "https://{{host}}/users/{{id}}?active={{active}}",
      pathParams: {
        id: { name: "id", value: "{{userId}}" },
      },
      queryParams: {
        active: { name: "active", value: "{{flag}}" },
      },
      headers: {
        Authorization: { value: "Bearer {{token}}" },
      },
      options: {
        caPath: "/certs/{{bundle}}",
        ipOverride: "{{ip}}",
        timeoutSecs: "{{timeout}}",
        userAgent: "UA {{ua}}",
      },
    } as any

    const environment: Environment = {
      id: "env",
      name: "env",
      variables: {
        host: { id: "v1", name: "host", value: "api.example.com", secure: false },
        userId: { id: "v2", name: "userId", value: "42", secure: false },
        flag: { id: "v3", name: "flag", value: "true", secure: false },
        token: { id: "v4", name: "token", value: "abc", secure: false },
        bundle: { id: "v5", name: "bundle", value: "root.pem", secure: false },
        ip: { id: "v6", name: "ip", value: "1.1.1.1", secure: false },
        timeout: { id: "v7", name: "timeout", value: "30", secure: false },
        ua: { id: "v8", name: "ua", value: "cli", secure: false },
      },
    }

    const resolved = resolveRequestVariables(request, environment)

    expect(resolved.url).toBe("https://api.example.com/users/42?active=true")
    expect(resolved.pathParams?.id.value).toBe("42")
    expect(resolved.queryParams?.active.value).toBe("true")
    expect(resolved.headers?.Authorization.value).toBe("Bearer abc")
    expect(resolved.options).toMatchObject({
      caPath: "/certs/root.pem",
      ipOverride: "1.1.1.1",
      timeoutSecs: "30",
      userAgent: "UA cli",
    })

    // Original request should remain unchanged
    expect(request.url).toBe("https://{{host}}/users/{{id}}?active={{active}}")
    expect(request.pathParams.id.value).toBe("{{userId}}")
  })

  it("skips injecting params whose values still contain placeholders", () => {
    const request = {
      url: "https://api.example.com/users/{{id}}",
      pathParams: { id: { value: "{{missing}}" } },
    } as any

    const resolved = resolveRequestVariables(request, {
      id: "env",
      name: "env",
      variables: {
        missing: { id: "v1", name: "missing", value: "{{stillMissing}}", secure: false },
      },
    } as Environment)

    expect(resolved.url).toBe("https://api.example.com/users/{{id}}")
    expect(resolved.pathParams?.id.value).toBe("{{stillMissing}}")
  })
})
