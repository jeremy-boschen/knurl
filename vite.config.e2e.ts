import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import checker from 'vite-plugin-checker'
import istanbul from 'vite-plugin-istanbul'
import { consoleForwardPlugin } from './scripts/vite-console-forward-plugin'
import { cssVarsExportPlugin } from './scripts/vite-css-vars-export-plugin'

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  worker: {
    format: 'es',
    rollupOptions: {}
  },
  plugins: [
    consoleForwardPlugin({
      // Enable console forwarding (default: true in dev mode)
      enabled: false,
      endpoint: '/api/debug/client-logs',
      levels: ['log', 'warn', 'error', 'info', 'debug'],
    }),
    react({
      babel: {
        plugins: [
          ['babel-plugin-react-compiler', {}],
        ],
      },
    }),
    {
      name: 'react-devtools-inject',
      apply: 'serve',
      transformIndexHtml(html) {
        return {
          html,
          tags: [
            {
              tag: 'script',
              attrs: { src: 'http://localhost:8097' },
              injectTo: 'head',
            },
          ],
        }
      },
    },
    // Extract CSS custom properties into JSON:
    // index.css => default bucket, App.css => custom bucket
    cssVarsExportPlugin({
      cssFiles: ['src/index.css', 'src/App.css'],
    }),
    tailwindcss(),
    // Istanbul instrumentation for E2E coverage collection
    istanbul({
      include: 'src/**/*.{js,ts,tsx}',
      exclude: [
        'node_modules',
        'test/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
      ],
      extension: ['.js', '.ts', '.tsx'],
      requireEnv: false, // Always instrument for E2E
      forceBuildInstrument: true,
      cypress: false,
    }),
    // Type-check TypeScript during dev and build
    checker({ typescript: true })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // This is needed for recent codemirror styling. No idea why
      '@codemirror/state': path.resolve(__dirname, './node_modules/@codemirror/state/dist/index.cjs'),
      '@codemirror/view': path.resolve(__dirname, './node_modules/@codemirror/view/dist/index.cjs'),
      '@codemirror/language': path.resolve(__dirname, './node_modules/@codemirror/language/dist/index.cjs'),
    },
  },
  optimizeDeps: {
    include: [
      'prettier',
      'prettier/standalone',
      'prettier/plugins/babel',
      'prettier/plugins/estree',
      'prettier/plugins/graphql',
      'prettier/plugins/html',
      'prettier/plugins/yaml',
      '@prettier/plugin-xml',
    ],
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**', '**/migrate/**', '**/coverage/**', '**/.nyc_output/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: 'es2022',
    minify: 'terser',
    sourcemap: process.env.NODE_ENV === 'production' ? false : true,
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
      },
    },
    rollupOptions: {
      plugins: [],
    },
  }
})
