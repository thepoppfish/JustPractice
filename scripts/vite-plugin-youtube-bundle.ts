import type { Plugin } from 'vite';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function runNodeScript(script: string): void {
  execFileSync(process.execPath, [path.join(root, script)], {
    cwd: root,
    stdio: 'inherit',
  });
}

/** After CRX writes dist/, bundle YouTube script and patch manifest (CRX cannot use pre-built JS as manifest entry). */
function bundleAndPatchManifest(): void {
  const manifestPath = path.join(root, 'dist', 'manifest.json');
  if (!fs.existsSync(manifestPath)) return;
  runNodeScript('scripts/build-youtube-bundle.mjs');
  runNodeScript('scripts/patch-crx-build.mjs');
}

export function youtubeContentBundlePlugin(): Plugin {
  return {
    name: 'justpractice-youtube-bundle',
    configureServer() {
      setTimeout(bundleAndPatchManifest, 2000);
    },
    closeBundle() {
      bundleAndPatchManifest();
    },
  };
}
