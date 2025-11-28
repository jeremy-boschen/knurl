import type { Plugin } from 'vite'

export function cssVarsExportPlugin(_options: any): Plugin {
  return {
    name: 'vite-css-vars-export-plugin',
  }
}
