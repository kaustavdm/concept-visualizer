import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  build: {
    // TF.js is already lazy-loaded via dynamic import(); its chunk is inherently large.
    chunkSizeWarningLimit: 2000
  },
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['vitest.setup.ts'],
    environment: 'jsdom'
  }
});
