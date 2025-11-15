import { promises as fs } from "node:fs"
import * as path from "node:path"

/**
 * Get the app data directory for the current test session
 * This is set by wdio.conf.ts in the before hook
 */
export async function getAppDataDir(): Promise<string> {
  const configDir = await browser.execute(() => {
    const globalWindow = window as any
    return globalWindow.__KNURL_E2E_CONFIG_DIR__
  })

  if (!configDir) {
    throw new Error(
      "App data directory not available. Make sure wdio.conf.ts is properly setting __KNURL_E2E_CONFIG_DIR__"
    )
  }

  return configDir
}

/**
 * Read a file from the app data directory
 * @param relativePath Path relative to the app data directory (e.g., "collections/abc123.json")
 * @returns File contents as string
 */
export async function readAppDataFile(relativePath: string): Promise<string> {
  const configDir = await getAppDataDir()
  const filePath = path.join(configDir, relativePath)

  try {
    return await fs.readFile(filePath, "utf-8")
  } catch (error) {
    if ((error as any).code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`)
    }
    throw error
  }
}

/**
 * Read and parse a JSON file from the app data directory
 * @param relativePath Path relative to the app data directory
 * @returns Parsed JSON object
 */
export async function readAppDataJson<T = unknown>(relativePath: string): Promise<T> {
  const content = await readAppDataFile(relativePath)
  return JSON.parse(content) as T
}

/**
 * Check if a file exists in the app data directory
 * @param relativePath Path relative to the app data directory
 */
export async function appDataFileExists(relativePath: string): Promise<boolean> {
  const configDir = await getAppDataDir()
  const filePath = path.join(configDir, relativePath)

  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Get file stats for a file in the app data directory
 * @param relativePath Path relative to the app data directory
 */
export async function getAppDataFileStats(
  relativePath: string
): Promise<Awaited<ReturnType<typeof fs.stat>>> {
  const configDir = await getAppDataDir()
  const filePath = path.join(configDir, relativePath)

  return await fs.stat(filePath)
}

/**
 * List files in a directory within the app data directory
 * @param relativePath Path relative to the app data directory
 */
export async function listAppDataFiles(relativePath: string): Promise<string[]> {
  const configDir = await getAppDataDir()
  const dirPath = path.join(configDir, relativePath)

  try {
    return await fs.readdir(dirPath)
  } catch (error) {
    if ((error as any).code === "ENOENT") {
      return []
    }
    throw error
  }
}

/**
 * Read binary file from app data directory
 * @param relativePath Path relative to the app data directory
 * @returns File contents as Buffer
 */
export async function readAppDataBinary(relativePath: string): Promise<Buffer> {
  const configDir = await getAppDataDir()
  const filePath = path.join(configDir, relativePath)

  try {
    return await fs.readFile(filePath)
  } catch (error) {
    if ((error as any).code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`)
    }
    throw error
  }
}
