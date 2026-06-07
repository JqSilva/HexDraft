// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';
import alpinejs from '@astrojs/alpinejs';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        ignored: [
          '**/src/lib/data/**',
          '**/hexdraft.db',
          '**/hexdraft.db-journal',
          '**/hexdraft.db-wal',
          '**/hexdraft.db-shm',
          '**/.puppeteer_profiles/**',
          '**/.astro/**'
        ],
      }
    },
    ssr: process.argv.includes('build') ? {
      noExternal: true
    } : {}
  },
  output: 'server',
  adapter:node({
    mode: 'standalone'
  }),
  integrations: [alpinejs(), react()]
});