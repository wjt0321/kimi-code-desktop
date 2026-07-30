import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/main',
      rollupOptions: { input: 'src/main/main.ts' },
    },
  },
  preload: {
    build: {
      outDir: 'dist/preload',
      externalizeDeps: false,
      rollupOptions: {
        input: 'src/preload/index.ts',
        output: { format: 'cjs' },
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react(), tailwindcss()],
    build: { outDir: 'dist/renderer' },
  },
});
