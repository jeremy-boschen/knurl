#!/usr/bin/env node

/**
 * migrate-to-logger.mjs
 *
 * Replaces console.log/warn/error calls with getSyncLogger from @/lib/logger
 *
 * Usage:
 *   node scripts/migrate-to-logger.mjs [--dry-run] [--verbose]
 *
 * Options:
 *   --dry-run             Show what would change without modifying files
 *   --verbose             Show detailed output for each file
 *   --log-only            Only replace console.log (skip warn/error)
 *   --show-replacements   Show before/after for each console call
 *   --file=path           Process only a specific file
 */

import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration
const SRC_DIR = path.join(__dirname, "../src-ui/src")
const LOGGER_IMPORT = 'import { getSyncLogger } from "@/lib/logger"'

// Parse CLI args
const args = process.argv.slice(2)
const isDryRun = args.includes("--dry-run")
const isVerbose = args.includes("--verbose")
const logOnly = args.includes("--log-only")
const showReplacements = args.includes("--show-replacements")
const fileArg = args.find((arg) => arg.startsWith("--file="))
const specificFile = fileArg ? fileArg.split("=")[1] : null

// Statistics
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  consoleCallsReplaced: 0,
  errors: 0,
}

/**
 * Check if file should be processed
 */
function shouldProcessFile(filePath) {
  const relativePath = path.relative(SRC_DIR, filePath)

  // Skip test files
  if (relativePath.includes(".test.ts") || relativePath.includes(".test.tsx")) {
    return false
  }

  // Skip e2e bridge (special console handling)
  if (relativePath.includes("e2e-bridge.ts")) {
    return false
  }

  // Only process .ts and .tsx files
  return filePath.endsWith(".ts") || filePath.endsWith(".tsx")
}

/**
 * Extract module name from file path for logger instance
 */
function getModuleName(filePath) {
  const relativePath = path.relative(SRC_DIR, filePath)
  // Remove file extension and convert to module name
  return relativePath.replace(/\.(tsx?|jsx?)$/, "").replace(/\\/g, "/")
}

/**
 * Check if file already has logger import
 */
function hasLoggerImport(content) {
  return /import\s+\{[^}]*getSyncLogger[^}]*\}\s+from\s+["']@\/lib\/logger["']/.test(content)
}

/**
 * Check if file already has a logger instance
 */
function hasLoggerInstance(content) {
  return /const\s+logger\s*=\s*getSyncLogger\s*\(/.test(content)
}

/**
 * Add logger import to file content
 */
function addLoggerImport(content) {
  // Find the last import statement
  const importRegex = /^import\s+.*?from\s+["'].*?["'];?\s*$/gm
  const imports = [...content.matchAll(importRegex)]

  if (imports.length === 0) {
    // No imports, add at the top
    return `${LOGGER_IMPORT}\n\n${content}`
  }

  // Add after the last import
  const lastImport = imports[imports.length - 1]
  const insertPos = lastImport.index + lastImport[0].length
  return content.slice(0, insertPos) + `\n${LOGGER_IMPORT}` + content.slice(insertPos)
}

/**
 * Add logger instance declaration
 */
function addLoggerInstance(content, moduleName) {
  const loggerDecl = `const logger = getSyncLogger("${moduleName}")\n`

  // Find position after imports and type imports
  const importRegex = /^import\s+.*?from\s+["'].*?["'];?\s*$/gm
  const imports = [...content.matchAll(importRegex)]

  if (imports.length === 0) {
    // No imports, add at the top
    return loggerDecl + content
  }

  // Add after the last import with proper spacing
  const lastImport = imports[imports.length - 1]
  const insertPos = lastImport.index + lastImport[0].length

  // Check if there's already a blank line after imports
  const afterImports = content.slice(insertPos)
  const needsExtraNewline = !afterImports.startsWith("\n\n")

  return (
    content.slice(0, insertPos) +
    (needsExtraNewline ? "\n" : "") +
    `\n${loggerDecl}` +
    content.slice(insertPos)
  )
}

/**
 * Parse arguments from console call
 * Handles: strings, template literals, variables, objects, function calls
 */
function parseConsoleArgs(args) {
  const argList = []
  let current = ""
  let depth = 0
  let inString = false
  let stringChar = null
  let templateDepth = 0

  for (let i = 0; i < args.length; i++) {
    const char = args[i]
    const prevChar = i > 0 ? args[i - 1] : null
    const nextChar = i < args.length - 1 ? args[i + 1] : null

    // Handle template literal ${...} expressions
    if (inString && stringChar === "`") {
      if (char === "$" && nextChar === "{") {
        templateDepth++
        current += char
        continue
      }
      if (char === "}" && templateDepth > 0) {
        templateDepth--
        current += char
        continue
      }
      if (templateDepth > 0) {
        current += char
        continue
      }
    }

    // Handle string boundaries
    if (!inString && (char === '"' || char === "'" || char === "`")) {
      inString = true
      stringChar = char
      current += char
    } else if (inString && char === stringChar && prevChar !== "\\") {
      inString = false
      stringChar = null
      current += char
    } else if (!inString && (char === "{" || char === "[" || char === "(")) {
      depth++
      current += char
    } else if (!inString && (char === "}" || char === "]" || char === ")")) {
      depth--
      current += char
    } else if (!inString && char === "," && depth === 0) {
      if (current.trim()) {
        argList.push(current.trim())
      }
      current = ""
    } else {
      current += char
    }
  }

  if (current.trim()) {
    argList.push(current.trim())
  }

  return argList
}

/**
 * Convert console arguments to logger format
 * Examples:
 *   console.error("msg", err) -> logger.error("msg", { error: err })
 *   console.warn("msg", { x: 1 }) -> logger.warn("msg", { x: 1 })
 *   console.log(`template ${x}`, y) -> logger.info(`template ${x}`, { y })
 */
function convertConsoleArgs(args, logLevel) {
  if (!args || args.trim() === "") {
    return [`""`, null]
  }

  const argList = parseConsoleArgs(args)

  if (argList.length === 0) {
    return [`""`, null]
  }

  // Single argument - use as-is
  if (argList.length === 1) {
    const arg = argList[0]
    // If it's already a string literal (any kind), use it directly
    if (arg.startsWith('"') || arg.startsWith("'") || arg.startsWith("`")) {
      return [arg, null]
    }
    // Non-string single arg - stringify it
    return [`\`\${${arg}}\``, null]
  }

  // Multiple arguments - first arg as message, rest as meta
  const firstArg = argList[0]
  const isFirstString =
    firstArg.startsWith('"') || firstArg.startsWith("'") || firstArg.startsWith("`")

  if (!isFirstString) {
    // No string message - combine all args
    const allVars = argList
      .map((arg) => {
        const varName = arg.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)$/)?.[1]
        return varName || `value: ${arg}`
      })
      .join(", ")
    return [`"${argList.join(" ")}"`, `{ ${allVars} }`]
  }

  // First arg is a string - use it as message
  if (argList.length === 2) {
    const secondArg = argList[1]
    // If second arg is already an object literal, use it directly
    if (secondArg.trim().startsWith("{")) {
      return [firstArg, secondArg]
    }
    // Single value - wrap it
    const varName = secondArg.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)$/)?.[1]
    if (varName) {
      return [firstArg, `{ ${varName} }`]
    }
    // Complex expression
    return [firstArg, `{ value: ${secondArg} }`]
  }

  // Multiple additional args - combine into meta object
  const restArgs = argList.slice(1)
  const metaObj = restArgs
    .map((arg) => {
      const varName = arg.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)$/)?.[1]
      return varName || `value: ${arg}`
    })
    .join(", ")

  return [firstArg, `{ ${metaObj} }`]
}

/**
 * Replace console.* calls with logger.* calls
 */
function replaceConsoleCalls(content, logLevel = "all") {
  const levels = logLevel === "log-only" ? ["log"] : ["debug", "log", "info", "warn", "error"]
  const replacements = []

  for (const level of levels) {
    // Map console methods to logger methods
    const loggerMethod = level === "log" ? "info" : level

    // Match console.level( and then find the matching closing paren
    // This handles nested function calls and multiline arguments
    const pattern = `console\\.${level}\\s*\\(`
    const regex = new RegExp(pattern, "g")

    let match
    const matches = []

    while ((match = regex.exec(content)) !== null) {
      const startPos = match.index
      const argsStart = match.index + match[0].length

      // Find matching closing paren
      let depth = 1
      let pos = argsStart
      let inString = false
      let stringChar = null

      while (pos < content.length && depth > 0) {
        const char = content[pos]
        const prevChar = pos > 0 ? content[pos - 1] : null

        if (!inString && (char === '"' || char === "'" || char === "`")) {
          inString = true
          stringChar = char
        } else if (inString && char === stringChar && prevChar !== "\\") {
          inString = false
          stringChar = null
        } else if (!inString) {
          if (char === "(") depth++
          if (char === ")") depth--
        }

        pos++
      }

      if (depth === 0) {
        const argsStr = content.substring(argsStart, pos - 1)
        const fullMatch = content.substring(startPos, pos)
        matches.push({ match: fullMatch, args: argsStr, index: startPos })
      }
    }

    // Replace in reverse order to maintain positions
    for (let i = matches.length - 1; i >= 0; i--) {
      const { match: fullMatch, args: argsStr, index } = matches[i]

      stats.consoleCallsReplaced++
      const [message, meta] = convertConsoleArgs(argsStr, level)

      const replacement = meta
        ? `logger.${loggerMethod}(${message}, ${meta})`
        : `logger.${loggerMethod}(${message})`

      if (showReplacements) {
        replacements.push({
          original: fullMatch,
          replacement,
        })
      }

      content = content.substring(0, index) + replacement + content.substring(index + fullMatch.length)
    }
  }

  // Show replacements if requested
  if (showReplacements && replacements.length > 0) {
    console.log("\n  Replacements:")
    replacements.forEach(({ original, replacement }) => {
      console.log(`    - ${original}`)
      console.log(`    + ${replacement}`)
    })
  }

  return content
}

/**
 * Process a single file
 */
async function processFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf-8")
    const originalContent = content

    // Check if file has any console calls
    const hasConsole = logOnly
      ? /console\.log\s*\(/.test(content)
      : /console\.(error|warn|log)\s*\(/.test(content)

    if (!hasConsole) {
      if (isVerbose) {
        console.log(`⏭️  ${path.relative(process.cwd(), filePath)} - no console calls`)
      }
      return
    }

    let newContent = content

    // Add logger import if not present
    if (!hasLoggerImport(newContent)) {
      newContent = addLoggerImport(newContent)
    }

    // Add logger instance if not present
    if (!hasLoggerInstance(newContent)) {
      const moduleName = getModuleName(filePath)
      newContent = addLoggerInstance(newContent, moduleName)
    }

    // Replace console calls
    const mode = logOnly ? "log-only" : "all"
    newContent = replaceConsoleCalls(newContent, mode)

    // Check if content changed
    if (newContent === originalContent) {
      if (isVerbose) {
        console.log(`⏭️  ${path.relative(process.cwd(), filePath)} - no changes needed`)
      }
      return
    }

    stats.filesModified++

    if (isDryRun) {
      console.log(`\n📝 Would modify: ${path.relative(process.cwd(), filePath)}`)
      // Show diff-like output
      const origLines = originalContent.split("\n")
      const newLines = newContent.split("\n")
      let diffShown = 0
      for (let i = 0; i < Math.max(origLines.length, newLines.length); i++) {
        if (origLines[i] !== newLines[i] && diffShown < 10) {
          if (origLines[i]) console.log(`  - ${origLines[i]}`)
          if (newLines[i]) console.log(`  + ${newLines[i]}`)
          diffShown++
        }
      }
    } else {
      await fs.writeFile(filePath, newContent, "utf-8")
      console.log(`✅ Modified: ${path.relative(process.cwd(), filePath)}`)
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message)
    stats.errors++
  }
}

/**
 * Recursively find all TypeScript files
 */
async function findTypeScriptFiles(dir) {
  const files = []
  const entries = await fs.readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await findTypeScriptFiles(fullPath)))
    } else if (shouldProcessFile(fullPath)) {
      files.push(fullPath)
    }
  }

  return files
}

/**
 * Main execution
 */
async function main() {
  console.log("🔍 Logger Migration Script")
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "MODIFY FILES"}`)
  console.log(`Priority: ${logOnly ? "console.log only" : "error/warn/log"}\n`)

  let files = []

  if (specificFile) {
    const fullPath = path.resolve(specificFile)
    if (await fs.stat(fullPath).catch(() => null)) {
      files = [fullPath]
      console.log(`Processing single file: ${fullPath}\n`)
    } else {
      console.error(`❌ File not found: ${fullPath}`)
      process.exit(1)
    }
  } else {
    console.log(`Scanning: ${SRC_DIR}\n`)
    files = await findTypeScriptFiles(SRC_DIR)
    console.log(`Found ${files.length} TypeScript files to process\n`)
  }

  // Process files
  for (const file of files) {
    stats.filesProcessed++
    await processFile(file)
  }

  // Print summary
  console.log("\n" + "=".repeat(60))
  console.log("📊 Migration Summary")
  console.log("=".repeat(60))
  console.log(`Files processed:       ${stats.filesProcessed}`)
  console.log(`Files modified:        ${stats.filesModified}`)
  console.log(`Console calls replaced: ${stats.consoleCallsReplaced}`)
  console.log(`Errors:                ${stats.errors}`)
  console.log("=".repeat(60))

  if (isDryRun) {
    console.log("\n💡 Run without --dry-run to apply changes")
  }

  process.exit(stats.errors > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
