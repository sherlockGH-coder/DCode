import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          'benchmark-runner': resolve('src/main/benchmark/runner.ts'),
        },
      },
    },
  },

  preload: {
    plugins: [externalizeDepsPlugin()],
  },

  renderer: {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-markdown': ['react-markdown', 'remark-gfm', 'rehype-raw'],
            'vendor-xterm': ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-webgl'],
            'vendor-highlight': ['react-syntax-highlighter/dist/esm/prism-light'],
            'vendor-icons': ['react-material-icon-theme'],
          },
        },
      },
    },
  },
});
