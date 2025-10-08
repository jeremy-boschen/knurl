#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function usage(message) {
  if (message) {
    console.error(message)
  }
  console.error(`\nUsage: node scripts/release-local.mjs <tag> [--notes <file>|--notes-text <text>] [--publish] [--no-build]\n`)
  process.exit(1)
}

const args = process.argv.slice(2)
if (args.length === 0) {
  usage('Release tag is required (e.g., v0.1.0).')
}

const tag = args[0]
if (!/^v\d+\.\d+\.\d+(-[\w.-]+)?$/.test(tag)) {
  usage(`Invalid tag "${tag}". Expected semantic version with leading v (e.g., v0.1.0).`)
}
const tagVersion = tag.replace(/^v/, '')

let notesFile = null
let notesText = ''
let publish = false
let skipBuild = false

for (let i = 1; i < args.length; i += 1) {
  const value = args[i]
  switch (value) {
    case '--notes': {
      const file = args[i + 1]
      if (!file) {
        usage('--notes flag requires a file path.')
      }
      notesFile = path.resolve(file)
      i += 1
      break
    }
    case '--notes-text': {
      const text = args[i + 1]
      if (!text) {
        usage('--notes-text flag requires a value.')
      }
      notesText = text
      i += 1
      break
    }
    case '--publish':
      publish = true
      break
    case '--no-build':
      skipBuild = true
      break
    default:
      usage(`Unknown argument: ${value}`)
  }
}

if (notesFile && !existsSync(notesFile)) {
  console.error(`Notes file not found: ${notesFile}`)
  process.exit(1)
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')

const runCommand = (command, commandArgs = [], options = {}) => {
  execFileSync(command, commandArgs, {
    cwd: repoRoot,
    stdio: 'inherit',
    ...options,
  })
}

const runCommandCapture = (command, commandArgs = [], options = {}) => {
  return execFileSync(command, commandArgs, {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    ...options,
  })
}

try {
  runCommandCapture('gh', ['--version'])
} catch (error) {
  console.error('The GitHub CLI (gh) is required but was not found in PATH.')
  process.exit(1)
}

const bundleRoot = path.join(repoRoot, 'src-tauri', 'target', 'release', 'bundle')

if (!skipBuild) {
  console.log('\n▶ Building Tauri application (yarn tauri build)...')
  runCommand('yarn', ['tauri', 'build'])
}

if (!existsSync(bundleRoot)) {
  console.error(`Bundle directory not found at ${bundleRoot}. Ensure the build completed successfully.`)
  process.exit(1)
}

const allowedExtensions = new Set([
  '.msi',
  '.exe',
  '.zip',
  '.dmg',
  '.gz',
  '.tar',
  '.appimage',
  '.deb',
  '.pkg',
  '.sig',
])

const collectArtifacts = (root) => {
  /** @type {string[]} */
  const files = []

  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const fullPath = path.join(dir, entry)
      const stats = statSync(fullPath)
      if (stats.isDirectory()) {
        walk(fullPath)
      } else if (stats.isFile()) {
        const ext = path.extname(entry).toLowerCase()
        if (allowedExtensions.has(ext) && fullPath.includes(tagVersion)) {
          files.push(fullPath)
        }
      }
    }
  }

  walk(root)
  return files
}

const artifacts = collectArtifacts(bundleRoot)
if (artifacts.length === 0) {
  console.error(`No release artifacts containing version "${tagVersion}" were found under ${bundleRoot}.`)
  process.exit(1)
}

console.log('\n▶ Discovered artifacts:')
for (const file of artifacts) {
  console.log(`  • ${path.relative(repoRoot, file)}`)
}

let repo
try {
  repo = runCommandCapture('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']).trim()
} catch (error) {
  console.error('Failed to determine the repository via `gh repo view`. Are you authenticated?')
  process.exit(1)
}

const releaseExists = (() => {
  try {
    runCommandCapture('gh', ['release', 'view', tag, '--repo', repo])
    return true
  } catch {
    return false
  }
})()

const ghArgs = releaseExists ? ['release', 'upload', tag] : ['release', 'create', tag]

if (!releaseExists) {
  ghArgs.push('--title', tag)
  ghArgs.push(publish ? '--latest' : '--draft')
  if (notesFile) {
    ghArgs.push('--notes-file', notesFile)
  } else if (notesText) {
    ghArgs.push('--notes', notesText)
  }
} else {
  if (notesFile) {
    ghArgs.push('--notes-file', notesFile)
  } else if (notesText) {
    ghArgs.push('--notes', notesText)
  }
  ghArgs.push('--clobber')
}

ghArgs.push('--repo', repo)
for (const artifact of artifacts) {
  ghArgs.push(artifact)
}

console.log('\n▶ Publishing release via GitHub CLI...')
console.log(`   gh ${ghArgs.join(' ')}`)

try {
  runCommand('gh', ghArgs)
  console.log('\n✅ Release completed successfully.')
} catch (error) {
  console.error('\nRelease command failed.')
  process.exit(error?.status ?? 1)
}
