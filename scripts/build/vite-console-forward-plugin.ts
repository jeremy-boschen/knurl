import type { Plugin } from 'vite'

export interface ConsoleForwardPluginOptions {
  enabled?: boolean
  endpoint?: string
  levels?: string[]
}

/**
 * Vite plugin for forwarding console logs to an endpoint
 * Currently disabled - commented out in vite configs
 */
export function consoleForwardPlugin(options: ConsoleForwardPluginOptions = {}): Plugin {
  return {
    name: 'console-forward-plugin',
    apply: 'serve',
    transform(code: string) {
      if (!options.enabled) {
        return code
      }
      return code
    },
  }
}
