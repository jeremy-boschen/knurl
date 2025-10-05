#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

const rgPattern = 'import\\s+\\{[^}]+\\}\\s+from\\s+"lucide-react"'
const cmd = `rg -n '${rgPattern}' -S src`
const stdout = execSync(cmd, { encoding: 'utf8' })
const lines = stdout.trim().split(/\n/).filter(Boolean)

/** @type {Map<string, Set<string>>} */
const iconToFiles = new Map()

for (const line of lines) {
  const idx = line.indexOf(':')
  if (idx === -1) continue
  const file = line.slice(0, idx)
  const imp = line.slice(idx + 1)
  const m = imp.match(/\{([^}]+)\}/)
  if (!m) continue
  let names = m[1].split(',').map((s) => s.trim())
  names = names.map((n) => (n.includes(' as ') ? n.split(' as ')[0].trim() : n))
  for (const name of names) {
    if (!iconToFiles.has(name)) iconToFiles.set(name, new Set())
    iconToFiles.get(name)?.add(file)
  }
}

const sorted = [...iconToFiles.entries()].sort((a, b) => a[0].localeCompare(b[0]))

let out = '# Lucide Icons Contact Sheet\n\n'
out += 'Summary of lucide-react icons used and their locations.\n\n'
for (const [icon, files] of sorted) {
  out += `- ${icon}:\n`
  for (const f of [...files].sort()) out += `  - ${f}\n`
}

mkdirSync('docs/reports', { recursive: true })
writeFileSync('docs/reports/lucide-contact-sheet.md', out)
console.log(out)

