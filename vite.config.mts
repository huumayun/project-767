import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Electron loads production via loadFile (file://), where CSP 'self' is
    // unreliable for font requests. The CSP does allow data:, so inline font
    // files and leave every other asset on Vite's default size-based rule.
    assetsInlineLimit: (filePath) =>
      /\.(woff2?|ttf|otf)$/i.test(filePath) ? true : undefined,
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
});
