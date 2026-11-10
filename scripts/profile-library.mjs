import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing value for ${name}`);
  return args[index + 1];
};
if (args.includes('--help')) {
  console.info('node scripts/profile-library.mjs --label NAME --sizes 25,100,500 --repeats 5 --output output/performance');
  process.exit(0);
}
const root = process.cwd();
const label = option('--label', 'profile');
const sizes = option('--sizes', '25,100,500').split(',').map(Number);
const repeats = Number(option('--repeats', '5'));
if (!/^[a-z0-9-]+$/.test(label) || !sizes.length || sizes.some(n => !Number.isInteger(n) || n < 1 || n > 2000) || !Number.isInteger(repeats) || repeats < 1 || repeats > 20) {
  throw new Error('Use a simple label, library sizes 1–2000 and 1–20 repeats.');
}
const dir = path.resolve(root, option('--output', 'output/performance'));
await fs.mkdir(dir, { recursive: true });
const resultPath = path.join(dir, `${label}-library.json`);
try {
  if (JSON.parse(await fs.readFile(resultPath, 'utf8')).complete) throw new Error('A completed profile already has this label; choose another label or output directory.');
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const base = JSON.parse(await fs.readFile(path.join(root, 'scripts/fixtures/performance-base.json'), 'utf8'));
function fixture(size) {
  const data = structuredClone(base);
  const now = Date.now();
  data.settings.uiLocale = 'en';
  data.library = Array.from({ length: size }, (_, i) => ({
    videoId: 'pf' + String(i).padStart(9, '0'), practiceToken: randomUUID(),
    title: 'Practice lesson ' + String(i).padStart(4, '0') + ' — listen, review and repeat 日々の練習',
    channel: 'Synthetic profiling channel ' + i % 7, addedAt: now - i * 1000,
    difficulty: ['N5', 'N4', 'N3', 'N2', 'N1'][i % 5],
    completedAt: i % 5 === 4 ? now - 86400000 : null, durationSec: 1800,
  }));
  data.videoSeconds = {};
  data.videoDailySeconds = {};
  data.videoPlaybackPositionSec = {};
  return data;
}
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium', headless: true, viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce',
  args: [`--disable-extensions-except=${path.join(root, 'dist')}`, `--load-extension=${path.join(root, 'dist')}`],
});
const result = {
  label, source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  browser: context.browser()?.version(), platform: `${os.platform()} ${os.release()}`, cpu: os.cpus()[0].model,
  method: 'Fresh dashboard documents with a warm background worker; unthrottled 1440×900 Chromium, reduced motion, local synthetic thumbnails. Timings include automation observation and two animation frames. A separate traced search trial is excluded from timing summaries.',
  bundleSha256: createHash('sha256').update(await fs.readFile(path.join(root, 'dist/assets/youtube-content.bundle.js'))).digest('hex'),
  sizes: [], errors: [],
};
const save = () => fs.writeFile(resultPath, JSON.stringify(result, null, 2));
const frame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function search(page, size) {
  const targetIndex = Math.min(12, size - 1);
  const queries = ['lesson ' + String(targetIndex).padStart(4, '0'), 'no-matching-fixture', ''];
  const observations = [];
  for (const query of queries) {
    const start = await page.evaluate(() => performance.now());
    await page.locator('#dash-search').fill(query);
    await frame(page);
    const elapsed = await page.evaluate(() => performance.now()) - start;
    const actual = await page.locator('[data-view-panel="library"] .video-card').count();
    const expected = !query ? size - Math.floor(size / 5) : query === 'no-matching-fixture' || targetIndex % 5 === 4 ? 0 : 1;
    if (actual !== expected) throw new Error(`Search produced ${actual} rows instead of ${expected} for ${query}`);
    observations.push({ query, ms: elapsed, matches: actual });
  }
  return observations;
}
try {
  await context.route('https://i.ytimg.com/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="18"><rect width="32" height="18" fill="#252b35"/></svg>' }));
  await context.addInitScript(() => {
    globalThis.__jpProfileTasks = [];
    new PerformanceObserver(list => { for (const e of list.getEntries()) globalThis.__jpProfileTasks.push({ start: e.startTime, duration: e.duration }); }).observe({ type: 'longtask', buffered: true });
  });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  const preparation = await context.newPage();
  for (const other of context.pages()) if (other !== preparation) await other.close();
  for (const size of sizes) {
    await worker.evaluate(async data => chrome.storage.local.set({ jpPractice: data }), fixture(size));
    const group = { size, trials: [] };
    for (let i = 0; i < repeats; i++) {
      const page = await context.newPage();
      page.on('pageerror', error => result.errors.push(error.message));
      await page.goto(`chrome-extension://${extensionId}/src/dashboard/index.html`);
      await page.locator('#dash-search').waitFor();
      await frame(page);
      const startupMs = await page.evaluate(() => performance.now());
      const observations = await search(page, size);
      const cdp = await context.newCDPSession(page);
      await cdp.send('HeapProfiler.collectGarbage');
      group.trials.push({ startupMs, search: observations, heap: await cdp.send('Runtime.getHeapUsage'), dom: await cdp.send('Memory.getDOMCounters'), longTasks: await page.evaluate(() => globalThis.__jpProfileTasks) });
      if (i === repeats - 1) await page.screenshot({ path: path.join(dir, `${label}-library-${size}.png`) });
      await page.close();
    }
    result.sizes.push(group);
    await save();
    console.info(`${label}: ${size} videos, startup max ${Math.max(...group.trials.map(t => t.startupMs)).toFixed(1)}ms, search max ${Math.max(...group.trials.flatMap(t => t.search.map(s => s.ms))).toFixed(1)}ms`);
  }
  // Trace a separate stress trial so DevTools instrumentation does not bias the
  // ordinary timing observations above.
  const size = sizes.at(-1);
  const traced = await context.newPage();
  await context.tracing.start({ screenshots: false, snapshots: true, sources: true });
  await traced.goto(`chrome-extension://${extensionId}/src/dashboard/index.html`);
  await traced.locator('#dash-search').waitFor();
  const cdp = await context.newCDPSession(traced);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.start');
  for (let i = 0; i < 3; i++) await search(traced, size);
  const { profile } = await cdp.send('Profiler.stop');
  await fs.writeFile(path.join(dir, `${label}-library.cpuprofile`), JSON.stringify(profile));
  await context.tracing.stop({ path: path.join(dir, `${label}-library-trace.zip`) });
  result.complete = true;
  await save();
  if (result.errors.length) process.exitCode = 1;
} catch (error) {
  result.fatalError = error.message;
  await save();
  throw error;
} finally { await context.close(); }
