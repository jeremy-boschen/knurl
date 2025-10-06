#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const releaseType = process.argv[2]
const allowed = new Set(['major', 'minor', 'patch'])
if (!allowed.has(releaseType)) {
  console.error('Usage: node scripts/update-version.mjs <major|minor|patch>')
  process.exit(1)
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')

function runGit(command, opts = {}) {
  return execSync(command, { cwd: repoRoot, stdio: 'pipe', encoding: 'utf8', ...opts }).trim()
}

const dirty = runGit('git status --porcelain')
if (dirty) {
  console.error('Repository has uncommitted changes. Commit or stash them before running the version updater.')
  process.exit(1)
}

const pkgPath = path.join(repoRoot, 'package.json')
const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf8'))
const currentVersion = pkgJson.version

const parts = currentVersion.split('.').map((value) => Number.parseInt(value, 10))
if (parts.length !== 3 || parts.some((value) => Number.isNaN(value) || value < 0)) {
  console.error(`Invalid semantic version in package.json: ${currentVersion}`)
  process.exit(1)
}

let [major, minor, patch] = parts
switch (releaseType) {
  case 'major':
    major += 1
    minor = 0
    patch = 0
    break
  case 'minor':
    minor += 1
    patch = 0
    break
  case 'patch':
    patch += 1
    break
  default:
    break
}

const newVersion = `${major}.${minor}.${patch}`
if (newVersion === currentVersion) {
  console.error('Calculated version matches the current version; aborting.')
  process.exit(1)
}

function writeJsonVersion(filePath) {
  const data = JSON.parse(readFileSync(filePath, 'utf8'))
  data.version = newVersion
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

writeJsonVersion(pkgPath)
writeJsonVersion(path.join(repoRoot, 'src-tauri', 'tauri.conf.json'))

const cargoTomlPath = path.join(repoRoot, 'src-tauri', 'Cargo.toml')
const cargoToml = readFileSync(cargoTomlPath, 'utf8')
const updatedCargoToml = cargoToml.replace(/^version\s*=\s*"\d+\.\d+\.\d+"/m, `version = "${newVersion}"`)
if (cargoToml === updatedCargoToml) {
  console.error('Failed to update src-tauri/Cargo.toml with the new version.')
  process.exit(1)
}
writeFileSync(cargoTomlPath, updatedCargoToml)

const cargoLockPath = path.join(repoRoot, 'src-tauri', 'Cargo.lock')
const cargoLock = readFileSync(cargoLockPath, 'utf8')
const lockPattern = /(\[\[package\]\]\s+name = "knurl"\s+version = ")(\d+\.\d+\.\d+)(")/
if (!lockPattern.test(cargoLock)) {
  console.error('Unable to locate knurl package entry in Cargo.lock.')
  process.exit(1)
}
const updatedCargoLock = cargoLock.replace(lockPattern, `$1${newVersion}$3`)
writeFileSync(cargoLockPath, updatedCargoLock)

const filesToStage = [
  pkgPath,
  path.join(repoRoot, 'src-tauri', 'tauri.conf.json'),
  cargoTomlPath,
  cargoLockPath,
]

runGit(`git add ${filesToStage.map((file) => path.relative(repoRoot, file)).join(' ')}`)

const tagName = `v${newVersion}`
try {
  execSync(`git rev-parse ${tagName}`, { cwd: repoRoot, stdio: 'ignore' })
  console.error(`Tag ${tagName} already exists. Aborting.`)
  process.exit(1)
} catch {
  // rev-parse throws when the tag is absent, which is expected.
}

runGit(`git commit -m "chore: release ${tagName}"`)
runGit(`git tag ${tagName}`)

console.log(`Version updated to ${newVersion}. Commit and tag ${tagName} created.`)
