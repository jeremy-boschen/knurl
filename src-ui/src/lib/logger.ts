import * as tauriLog from "@tauri-apps/plugin-log"

/**
 * Logger instance with methods for different log levels
 */
export interface Logger {
  debug(message: string, meta?: Record<string, string>): Promise<void>
  info(message: string, meta?: Record<string, string>): Promise<void>
  warn(message: string, meta?: Record<string, string>): Promise<void>
  error(message: string, meta?: Record<string, string>): Promise<void>
}

/**
 * Create a logger instance for a specific module/context
 * Module name is automatically included in the message for better debugging
 *
 * @param moduleName - The name of the module using this logger (e.g., "components/auth")
 * @returns Logger instance with async methods
 */
export function getLogger(moduleName: string): Logger {
  const formatMessage = (level: string, msg: string) => `[${moduleName}] [${level}] ${msg}`

  return {
    async debug(message: string, meta?: Record<string, string>) {
      await tauriLog.debug(formatMessage("DEBUG", message), {
        keyValues: meta,
      })
    },
    async info(message: string, meta?: Record<string, string>) {
      await tauriLog.info(formatMessage("INFO", message), {
        keyValues: meta,
      })
    },
    async warn(message: string, meta?: Record<string, string>) {
      await tauriLog.warn(formatMessage("WARN", message), {
        keyValues: meta,
      })
    },
    async error(message: string, meta?: Record<string, string>) {
      await tauriLog.error(formatMessage("ERROR", message), {
        keyValues: meta,
      })
    },
  }
}

/**
 * Create a synchronous wrapper that queues log messages
 * Useful for situations where you can't await promises
 */
export function getSyncLogger(moduleName: string): {
  debug(message: string, meta?: Record<string, string>): void
  info(message: string, meta?: Record<string, string>): void
  warn(message: string, meta?: Record<string, string>): void
  error(message: string, meta?: Record<string, string>): void
} {
  const logger = getLogger(moduleName)

  return {
    debug(message: string, meta?: Record<string, string>) {
      logger.debug(message, meta).catch(() => {})
    },
    info(message: string, meta?: Record<string, string>) {
      logger.info(message, meta).catch(() => {})
    },
    warn(message: string, meta?: Record<string, string>) {
      logger.warn(message, meta).catch(() => {})
    },
    error(message: string, meta?: Record<string, string>) {
      logger.error(message, meta).catch(() => {})
    },
  }
}
