import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync } from 'fs';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'KnurlReactPanels',
      fileName: 'index',
      formats: ['es']
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'style.css';
          return assetInfo.name || 'asset';
        }
      }
    },
    sourcemap: true,
    minify: false,
    cssCodeSplit: false
  },
  plugins: [
    {
      name: 'copy-css',
      writeBundle() {
        try {
          copyFileSync(
            resolve(__dirname, 'src/style.css'),
            resolve(__dirname, 'dist/style.css')
          );
        } catch (e) {
          console.warn('Could not copy CSS file:', e);
        }
      }
    }
  ]
});
