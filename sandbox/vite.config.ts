import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

export default defineConfig({
  plugins: [tailwindcss()],
  root: projectRoot,
  server: {
    port: 3333,
    open: '/sandbox/index.html'
  },
  resolve: {
    alias: {
      '@': path.resolve(projectRoot, 'src')
    }
  }
});
