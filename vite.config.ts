import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';
import { youtubeContentBundlePlugin } from './scripts/vite-plugin-youtube-bundle';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [youtubeContentBundlePlugin(), crx({ manifest })],
  build: {
    /** Stable chunk paths so YouTube’s loader always imports files that exist after `npm run build` + extension reload. */
    rollupOptions: {
      input: {
        welcome: path.resolve(rootDir, 'src/welcome/index.html'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
