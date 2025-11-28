import type { Plugin } from 'vite'

export function consoleForwardPlugin(_options: any): Plugin {
  return {
    name: 'vite-console-forward-plugin',
  }
}
