#!/usr/bin/env node

/**
 * Generates "portal" archives that wrap the primary platform-specific artefacts
 * produced by `yarn tauri build`. The result is a distribution-friendly ZIP
 * containing the installer (Windows) or raw image (macOS / Linux).
 *
 * Usage:
 *   node scripts/portal-package.mjs [--no-build] [--out <relative|absolute path>]
 */

import { execFileSync } from "node:child_process"
import { createWriteStream, existsSync, readdirSync, statSync } from "node:fs"
import { mkdir, readFile, rm } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { ZipFile } from "yazl"

const args = process.argv.slice(2)
let skipBuild = false
let outputRootArg = null

for (let i = 0; i < args.length; i += 1) {
  const value = args[i]
  if (value === "--no-build") {
    skipBuild = true
  } else if (value === "--out") {
    const target = args[i + 1]
    if (!target) {
      console.error("The --out flag requires a directory argument.")
      process.exit(1)
    }
    outputRootArg = target
    i += 1
  } else {
    console.error(`Unknown argument: ${value}`)
    process.exit(1)
  }
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, "..")
const bundleRoot = path.join(repoRoot, "src-tauri", "target", "release", "bundle")

const readJson = async (absolutePath) => JSON.parse(await readFile(absolutePath, "utf8"))

const runBuild = () => {
  console.log("▶ Building Tauri release artefacts (yarn tauri build)...")
  execFileSync("yarn tauri build", {
    cwd: repoRoot,
    stdio: "inherit",
    shell: true,
  })
}

const collectFiles = (root) => {
  /** @type {string[]} */
  const discovered = []
  const stack = [root]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue
    const entries = readdirSync(current)
    for (const entry of entries) {
      const fullPath = path.join(current, entry)
      const stats = statSync(fullPath)
      if (stats.isDirectory()) {
        stack.push(fullPath)
      } else if (stats.isFile()) {
        discovered.push(fullPath)
      }
    }
  }
  return discovered
}

const classifyPlatform = (filePath) => {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === ".exe") return "windows"
  if (ext === ".dmg") return "macos"
  if (ext === ".appimage") return "linux"
  return null
}

const scoreArtifact = (filePath, platform, version) => {
  const name = path.basename(filePath).toLowerCase()
  let score = 0
  if (name.includes(version.toLowerCase())) {
    score += 5
  }
  if (platform === "windows") {
    if (name.endsWith(".exe")) score += 10
    if (name.includes("setup")) score += 3
    if (name.includes("x64")) score += 1
  } else if (platform === "macos") {
    if (name.endsWith(".dmg")) score += 10
  } else if (platform === "linux") {
    if (name.includes("appimage")) score += 10
  }
  return score
}

const zipSingleFile = async (source, destination, entryName) => {
  await rm(destination, { force: true })

  await new Promise((resolve, reject) => {
    const zipfile = new ZipFile()
    const output = createWriteStream(destination)

    output.on("close", resolve)
    output.on("error", reject)
    zipfile.outputStream.on("error", reject)

    zipfile.addFile(source, entryName)
    zipfile.outputStream.pipe(output)
    zipfile.end()
  })
}

const main = async () => {
  if (!skipBuild) {
    runBuild()
  }

  if (!existsSync(bundleRoot)) {
    console.error(`Bundle directory not found at ${bundleRoot}. Run "yarn tauri build" first.`)
    process.exit(1)
  }

  const pkg = await readJson(path.join(repoRoot, "package.json"))
  const tauriConfigPath = path.join(repoRoot, "src-tauri", "tauri.conf.json")
  const tauriConfig = existsSync(tauriConfigPath) ? await readJson(tauriConfigPath) : {}
  const version = tauriConfig.version ?? pkg.version
  if (!version) {
    console.error("Unable to determine application version from package.json or tauri.conf.json.")
    process.exit(1)
  }

  const artefacts = collectFiles(bundleRoot)
  const selections = new Map()
  for (const filePath of artefacts) {
    if (filePath.toLowerCase().endsWith(".sig")) {
      continue
    }
    const platform = classifyPlatform(filePath)
    if (!platform) {
      continue
    }
    const score = scoreArtifact(filePath, platform, version)
    const current = selections.get(platform)
    if (!current || score > current.score) {
      selections.set(platform, { path: filePath, score })
    }
  }

  if (selections.size === 0) {
    console.error("No build artefacts suitable for portal packaging were found.")
    process.exit(1)
  }

  const outputRoot = outputRootArg ? path.resolve(repoRoot, outputRootArg) : path.join(repoRoot, "dist", "portal")
  const versionDir = path.join(outputRoot, version)
  await mkdir(versionDir, { recursive: true })

  console.log(`▶ Writing portal archives to ${path.relative(repoRoot, versionDir)}`)

  for (const [platform, info] of selections) {
    const baseName = path.basename(info.path)
    const zipName = `knurl-${version}-${platform}.zip`
    const zipPath = path.join(versionDir, zipName)
    await zipSingleFile(info.path, zipPath, baseName)
    console.log(`  • ${platform.padEnd(7)} -> ${path.relative(repoRoot, zipPath)}`)
  }

  console.log("✓ Portal packaging complete.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
