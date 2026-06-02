import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dist = path.join(root, 'dist');
const manifestPath = path.join(dist, 'manifest.json');
const bundlePath = path.join(dist, 'assets', 'youtube-content.bundle.js');

const distReady = fs.existsSync(manifestPath) && fs.existsSync(bundlePath);

describe('extension dist (YouTube content script packaging)', () => {
  it.skipIf(!distReady)('verify script passes on built dist/', () => {
    execFileSync('node', [path.join(root, 'scripts/verify-extension-dist.mjs')], {
      cwd: root,
      stdio: 'pipe',
    });
  });

  it.skipIf(!distReady)('manifest uses single bundle, not CRXJS loader', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      content_scripts?: { js?: string[] }[];
    };
    const js = manifest.content_scripts?.flatMap((s) => s.js ?? []) ?? [];
    expect(js).toEqual(['assets/youtube-content.bundle.js']);
    expect(js.some((f) => f.includes('loader'))).toBe(false);
  });

  it.skipIf(!distReady)('bundle contains panel host and boot', () => {
    const bundle = fs.readFileSync(bundlePath, 'utf8');
    expect(bundle).toContain('jp-practice-yt-panel-host');
    expect(bundle).toContain('mountWatchPanelShellSync');
    expect(bundle).toContain('boot();');
  });
});
