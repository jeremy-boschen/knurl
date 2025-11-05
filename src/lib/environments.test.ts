import { describe, it, expect } from "vitest"
import { resolveVariablesPhase, type RequestContext } from "@/request/pipeline"
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

