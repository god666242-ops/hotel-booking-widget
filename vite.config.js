import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'import.meta.env.VITE_API_URL': JSON.stringify('https://hotel-booking-api.onrender.com/api'),
    'import.meta.env.MODE': JSON.stringify('production'),
    'import.meta.env.DEV': false,
    'import.meta.env.PROD': true,
  },
  build: {
    outDir: 'dist',
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        engine: resolve(__dirname, 'src/main.js'),
        index: resolve(__dirname, 'index.html'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'engine') return 'engine.js';
          return 'assets/[name]-[hash].js';
        },
        // Use 'iife' or keep standard format without dynamic import.meta
        format: 'iife',
        name: 'HotelBookingEngine',
        inlineDynamicImports: true,
      },
    },
  },
});