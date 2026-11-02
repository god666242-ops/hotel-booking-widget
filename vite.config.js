import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
  build: {
    outDir: 'dist',
    cssCodeSplit: false,
    lib: {
      entry: 'src/main.js',
      name: 'HotelBookingEngine',
      fileName: () => 'engine.js',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  server: {
    port: 3001,
  },
});