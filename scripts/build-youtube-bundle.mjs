/**
 * Single-file YouTube content script (no CRXJS loader / no split chunks).
 */
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const entry = path.join(root, 'src/content/youtube.ts');
const outDirs = [
  path.join(root, 'dist', 'assets'),
  path.join(root, 'public', 'assets'),
];

const buildOptions = {
  entryPoints: [entry],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  sourcemap: true,
  logLevel: 'info',
  // Resolve shared @imports before embedding CSS. A text loader leaves relative
  // imports unresolved on youtube.com, unlike Vite's extension-page CSS pipeline.
  plugins: [{
    name: 'inline-shadow-css',
    setup(build) {
      build.onLoad({ filter: /\.css$/ }, async ({ path: cssPath }) => {
        const result = await esbuild.build({
          entryPoints: [cssPath], bundle: true, write: false,
          target: 'chrome120', logLevel: 'silent',
        });
        return { contents: `export default ${JSON.stringify(result.outputFiles[0].text)};`, loader: 'js' };
      });
    },
  }],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
};

for (const dir of outDirs) {
  fs.mkdirSync(dir, { recursive: true });
  const outfile = path.join(dir, 'youtube-content.bundle.js');
  await esbuild.build({ ...buildOptions, outfile });
  console.info('[build-youtube-bundle] wrote', outfile);
}
