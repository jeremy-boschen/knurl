// ESM worker: new Worker(new URL("./prettier.worker.ts", import.meta.url), { type: "module" })

import type { Options } from "prettier"
import prettier from "prettier/standalone"

import type { CodeLanguage } from "@/types"

type FormatReq = {
  id: number
  code: string
  language: CodeLanguage
  options?: Options
}

type WarmupReq = {
  type: "warmup"
  languages?: CodeLanguage[]
}

type FormatRes =
  | { id: number; ok: true; formatted: string; ms: number }
  | { id: number; ok: false; error: string; formatted: string; ms: number }

// biome-ignore lint/suspicious/noExplicitAny: OK
const pluginCache = new Map<string, any>()
const loadedParsers = new Set<string>() // minor guard to avoid duplicate loads in a session

// biome-ignore lint/suspicious/noExplicitAny: OK
async function loadPlugin(key: string, loader: () => Promise<any>) {
  if (pluginCache.has(key)) {
    return pluginCache.get(key)
  }
  const mod = await loader()
  pluginCache.set(key, mod.default ?? mod)
  return pluginCache.get(key)
}

function parserFor(language: CodeLanguage): string | null {
  switch (language) {
    case "json":
      return "json"
    case "yaml":
      return "yaml"
    case "xml":
      return "xml"
    case "html":
      return "html"
    case "graphql":
      return "graphql"
    case "javascript":
      return "babel"
    default:
      return null
  }
}

// Load minimal plugin set per language
// biome-ignore lint/suspicious/noExplicitAny: OK
async function pluginsFor(language: CodeLanguage): Promise<any[]> {
  switch (language) {
    case "json": {
      // Needs babel + estree in Prettier v3
      const [babel, estree] = await Promise.all([
        loadPlugin("babel", () => import("prettier/plugins/babel")),
        loadPlugin("estree", () => import("prettier/plugins/estree")),
      ])
      return [babel, estree]
    }
    case "yaml": {
      const yaml = await loadPlugin("yaml", () => import("prettier/plugins/yaml"))
      return [yaml]
    }
    case "css":
    case "html": {
      const html = await loadPlugin("html", () => import("prettier/plugins/html"))
      return [html]
    }
    case "graphql": {
      const graphql = await loadPlugin("graphql", () => import("prettier/plugins/graphql"))
      return [graphql]
    }
    case "xml": {
      // Official Prettier XML plugin
      const xml = await loadPlugin("xml", () => import("@prettier/plugin-xml"))
      return [xml]
    }
    case "javascript": {
      const [babel, estree] = await Promise.all([
        loadPlugin("babel", () => import("prettier/plugins/babel")),
        loadPlugin("estree", () => import("prettier/plugins/estree")),
      ])
      return [babel, estree]
    }
    default:
      return []
  }
}

async function format(
  code: string,
  language: CodeLanguage,
  options?: Options,
): Promise<{ ok: boolean; out: string; ms: number; err?: string }> {
  const start = performance.now()
  const parser = parserFor(language)
  if (!parser) {
    return { ok: true, out: code, ms: performance.now() - start } // passthrough
  }

  try {
    const plugins = await pluginsFor(language)
    loadedParsers.add(parser)
    const out = await prettier.format(code, {
      parser,
      plugins,
      tabWidth: 2,
      useTabs: false,
      printWidth: 100,
      ...options,
    })
    return { ok: true, out, ms: performance.now() - start }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, out: code, ms: performance.now() - start, err: message }
  }
}

self.addEventListener("message", async (ev: MessageEvent<FormatReq | WarmupReq>) => {
  const data = ev.data

  // Optional warmup: preload plugins so first format is instant
  if ("type" in data && data.type === "warmup") {
    const langs: CodeLanguage[] = data.languages ?? ["json", "yaml", "xml", "html", "graphql"]
    await Promise.all(
      langs.map(async (l) => {
        const p = parserFor(l)
        if (p && !loadedParsers.has(p)) {
          await pluginsFor(l)
        }
      }),
    )
    return
  }

  const { id, code, language, options } = data as FormatReq
  const result = await format(code, language, options)
  if (result.ok) {
    self.postMessage({ id, ok: true, formatted: result.out, ms: result.ms } as FormatRes)
  } else {
    const error = result.err ?? "Unknown error"
    self.postMessage({ id, ok: false, error, formatted: result.out, ms: result.ms } as FormatRes)
  }
})
