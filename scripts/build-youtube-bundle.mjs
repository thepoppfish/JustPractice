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
  minify: true,
  charset: 'utf8',
  sourcemap: true,
  logLevel: 'info',
  // Resolve shared @imports before embedding CSS. A text loader leaves relative
  // imports unresolved on youtube.com, unlike Vite's extension-page CSS pipeline.
  plugins: [{
    name: 'watch-message-scope',
    setup(build) {
      // The standalone watch script does not ship dashboard/onboarding copy.
      // Shared calendar labels live outside those namespaces. Fail at build
      // time if a future content dependency starts using page-only messages.
      build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, ({ path: sourcePath }) => {
        if (!path.relative(root, sourcePath).replaceAll('\\', '/').startsWith('src/')) return;
        if (/['"`](?:dash|welcome)\./.test(fs.readFileSync(sourcePath, 'utf8'))) {
          return { errors: [{ text: 'Watch dependencies must use shared messages, not dash.* or welcome.* page-only copy.' }] };
        }
      });
      build.onLoad({ filter: /[/\\]i18n[/\\]locales[/\\][a-z]+\.json$/ }, ({ path: localePath }) => {
        const dictionary = JSON.parse(fs.readFileSync(localePath, 'utf8'));
        const content = Object.fromEntries(Object.entries(dictionary).filter(([key]) => !key.startsWith('dash.') && !key.startsWith('welcome.')));
        return { contents: JSON.stringify(content), loader: 'json' };
      });
    },
  }, {
    name: 'inline-shadow-css',
    setup(build) {
      build.onLoad({ filter: /\.css$/ }, async ({ path: cssPath }) => {
        const result = await esbuild.build({
          entryPoints: [cssPath], bundle: true, write: false,
          target: 'chrome120', minify: true, charset: 'utf8', logLevel: 'silent',
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
