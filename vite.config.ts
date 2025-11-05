import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import tailwindcss from '@tailwindcss/vite'
import checker from 'vite-plugin-checker'
import { resolve } from "node:path";
import { visualizer } from "rollup-plugin-visualizer";
import { consoleForwardPlugin } from "./scripts/vite-console-forward-plugin";
import { cssVarsExportPlugin } from "./scripts/vite-css-vars-export-plugin";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(({
  worker: {
    format: "es",
    rollupOptions: {
    }
  },
  plugins: [
    consoleForwardPlugin({
      // Enable console forwarding (default: true in dev mode)
      enabled: false,
      endpoint: "/api/debug/client-logs",
      levels: ["log", "warn", "error", "info", "debug"],
    }),
    react(),
    {
      name: "react-devtools-inject",
      apply: "serve",
      transformIndexHtml(html) {
        return {
          html,
          tags: [
            {
              tag: "script",
              attrs: { src: "http://localhost:8097" },
              injectTo: "head",
            },
          ],
        }
      },
    },
    // Extract CSS custom properties into JSON:
    // index.css => default bucket, App.css => custom bucket
    cssVarsExportPlugin({
      cssFiles: ["src/index.css", "src/App.css"],
    }),
    tailwindcss(),
    // Type-check TypeScript during dev and build
    checker({ typescript: true })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // This is needed for recent codemirror styling. No idea why
      '@codemirror/state': path.resolve(__dirname, './node_modules/@codemirror/state/dist/index.cjs'),
      '@codemirror/view': path.resolve(__dirname, './node_modules/@codemirror/view/dist/index.cjs'),
      '@codemirror/language': path.resolve(__dirname, './node_modules/@codemirror/language/dist/index.cjs'),
    },
  },
  optimizeDeps: {
    include: [
      "prettier",
      "prettier/standalone",
      "prettier/plugins/babel",
      "prettier/plugins/estree",
      "prettier/plugins/graphql",
      "prettier/plugins/html",
      "prettier/plugins/yaml",
      "@prettier/plugin-xml",
    ],
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**", "**/migrate/**"],
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: "es2022",
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    // Roll back prior chunk optimizations: use Vite defaults
    // Remove manualChunks and special splitting; keep only input entry.
    rollupOptions: {
      plugins: [
        // Enable bundle analyzer when ANALYZE=1
        process.env.ANALYZE ? visualizer({
          filename: "dist/stats.html",
          template: "treemap",
          gzipSize: true,
          brotliSize: true,
          open: false,
        }) : undefined,
      ].filter(Boolean),
    },
  }
}));
