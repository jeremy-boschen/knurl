import fs from "node:fs"
import path from "node:path"

type Options = {
  cssFiles?: string[] // [0] = default (index.css), [1] = custom (App.css)
  outFile?: string
}

type Bucket = {
  light: Record<string, string>
  dark: Record<string, string>
}

type Extracted = {
  comment: string
  default: Bucket
  custom: Bucket
  defaultNames: string[]
  customNames: string[]
}

function readFileSafe(absPath: string): string | null {
  try {
    return fs.readFileSync(absPath, "utf8")
  } catch {
    return null
  }
}

function extractBlockVars(css: string, selector: string): Record<string, string> {
  const out: Record<string, string> = {}
  const blockRe = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\}`, "g")
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(css))) {
    const body = m[1]
    const varRe = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g
    let v: RegExpExecArray | null
    while ((v = varRe.exec(body))) {
      const name = v[1]
      out[name] = v[2].trim()
    }
  }
  return out
}

function stableStringify(value: any): string {
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort()
    const body = keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as any)[k])}`).join(",")
    return `{${body}}`
  }
  return JSON.stringify(value)
}

function writeJsonIfChanged(outFileAbs: string, data: Extracted) {
  const dir = path.dirname(outFileAbs)
  fs.mkdirSync(dir, { recursive: true })

  // Normalize current payload for comparison (ignore timestamp in comment)
  const normalizedCurrent = { ...data, comment: "<normalized>" }
  const currentStr = stableStringify(normalizedCurrent)

  let existingParsed: Extracted | null = null
  try {
    const prev = fs.readFileSync(outFileAbs, "utf8")
    existingParsed = JSON.parse(prev) as Extracted
  } catch {
    // ignore
  }

  if (existingParsed) {
    const normalizedExisting = { ...existingParsed, comment: "<normalized>" }
    const existingStr = stableStringify(normalizedExisting)
    if (existingStr === currentStr) {
      // No material changes; skip write to avoid git churn
      return
    }
  }

  fs.writeFileSync(outFileAbs, JSON.stringify(data, null, 2) + "\n", "utf8")
}

function generateExtracted(root: string, opts: Required<Options>) {
  const [defaultFile, customFile] = opts.cssFiles
  const defaultCss = defaultFile ? readFileSafe(path.resolve(root, defaultFile)) ?? "" : ""
  const customCss = customFile ? readFileSafe(path.resolve(root, customFile)) ?? "" : ""

  const defLight = extractBlockVars(defaultCss, ":root")
  const defDark = extractBlockVars(defaultCss, ".dark")

  const cusLight = extractBlockVars(customCss, ":root")
  const cusDark = extractBlockVars(customCss, ".dark")

  const defaultNames = Array.from(new Set([...Object.keys(defLight), ...Object.keys(defDark)]))
  const customNames = Array.from(new Set([...Object.keys(cusLight), ...Object.keys(cusDark)]))

  const payload: Extracted = {
    comment: `This file is auto-generated at build time by vite-css-vars-export-plugin.ts. Last generated on ${new Date().toISOString()}`,
    default: { light: defLight, dark: defDark },
    custom: { light: cusLight, dark: cusDark },
    defaultNames,
    customNames,
  }

  const outFileAbs = path.resolve(root, opts.outFile)
  writeJsonIfChanged(outFileAbs, payload)
}

export function cssVarsExportPlugin(options: Options = {}) {
  const opts: Required<Options> = {
    cssFiles: options.cssFiles ?? ["src/index.css", "src/App.css"],
    outFile: options.outFile ?? "src/lib/theme/extracted-css-vars.json",
  }

  let rootDir = process.cwd()

  return {
    name: "css-vars-export",
    enforce: "post" as const,

    configResolved(config: any) {
      rootDir = config.root ?? process.cwd()
    },

    buildStart() {
      generateExtracted(rootDir, opts)
    },

    handleHotUpdate(ctx: any) {
      if (ctx.file.endsWith(".css")) {
        generateExtracted(rootDir, opts)
      }
    },
  }
}
