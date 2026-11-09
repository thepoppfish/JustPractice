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
  console.info('node scripts/profile-watch.mjs --label NAME --seconds 600 --output output/performance [--live-video VIDEO_ID] [--debug]');
  process.exit(0);
}
const label = option('--label', 'profile');
const seconds = Number(option('--seconds', '600'));
const liveVideo = option('--live-video', null);
if (!/^[a-z0-9-]+$/.test(label) || !Number.isInteger(seconds) || seconds < 60 || seconds > 3600) throw new Error('Use a simple label and 60–3600 seconds.');
if (liveVideo && !/^[a-zA-Z0-9_-]{11}$/.test(liveVideo)) throw new Error('Use an 11-character YouTube video ID.');
const root = process.cwd();
const dir = path.resolve(root, option('--output', 'output/performance'));
await fs.mkdir(dir, { recursive: true });
const resultPath = path.join(dir, `${label}-watch-session.json`);
try {
  if (JSON.parse(await fs.readFile(resultPath, 'utf8')).complete) throw new Error('A completed profile already has this label; choose another label or output directory.');
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const profile = JSON.parse(await fs.readFile(path.join(root, 'scripts/fixtures/performance-base.json'), 'utf8'));
profile.settings.pauseWhenUnfocused = false;
profile.settings.watchPanelXpToastsEnabled = false;
profile.library = [{ ...profile.library[0], videoId: liveVideo || 'pf000000000', practiceToken: randomUUID(), completedAt: null, durationSec: liveVideo ? null : 1800, title: liveVideo ? 'Public project tutorial' : 'Synthetic sustained-playback workload', channel: liveVideo ? 'Public YouTube video' : 'Local profiling fixture' }];
profile.videoSeconds = {};
profile.videoDailySeconds = {};
profile.videoPlaybackPositionSec = {};
profile.dailySeconds = {};
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium', headless: true, viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'en-US',
  args: [`--disable-extensions-except=${path.join(root, 'dist')}`, `--load-extension=${path.join(root, 'dist')}`],
});
const result = {
  label, plannedSeconds: seconds, source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  browser: context.browser()?.version(), platform: `${os.platform()} ${os.release()}`, cpu: os.cpus()[0].model,
  method: liveVideo
    ? 'Anonymous live YouTube page with a muted, natively looped public video; normal network/player code, visible tab and focus gating disabled. Whole-page renderer heap/long tasks include YouTube, not just extension work.'
    : 'Real HTMLVideoElement playing a canvas MediaStream at 5 fps, visible tab, focus gating disabled; synthetic YouTube page, no streaming/CDN/ad workload. Isolated installed extension. Renderer JS heap and DOM only, not total Chrome process memory.',
  liveVideo,
  bundleBytes: (await fs.stat(path.join(root, 'dist/assets/youtube-content.bundle.js'))).size,
  bundleSha256: createHash('sha256').update(await fs.readFile(path.join(root, 'dist/assets/youtube-content.bundle.js'))).digest('hex'),
  samples: [], errors: [], console: [], fixture: profile,
};
const save = () => fs.writeFile(resultPath, JSON.stringify(result, null, 2));
try {
  if (!liveVideo) await context.route('**/*', route => {
    if (route.request().url() === 'https://www.youtube.com/watch?v=pf000000000') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><title>Synthetic sustained-playback workload - YouTube</title></head><body style="background:#101216;color:#f1f3f7;font:16px system-ui"><main id="jp-profile-fixture"><ytd-watch-flexy video-id="pf000000000"><h1 class="title">Synthetic sustained-playback workload</h1><div id="channel-name"><a>Local profiling fixture</a></div><div id="movie_player"><video muted autoplay playsinline width="640" height="360"></video></div></ytd-watch-flexy><p>Local canvas stream. This is a performance workload, not live YouTube playback validation.</p></main></body></html>' });
    return route.request().url().startsWith('http') ? route.abort() : route.continue();
  });
  await context.addInitScript(() => {
    globalThis.__jpProfile = { longTasks: [], calendarReplacements: 0 };
    new PerformanceObserver(list => { for (const e of list.getEntries()) globalThis.__jpProfile.longTasks.push({ start: e.startTime, duration: e.duration }); }).observe({ type: 'longtask', buffered: true });
  });
  if (args.includes('--debug')) await context.addInitScript(() => localStorage.setItem('jpPracticeDebug', '1'));
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  await worker.evaluate(async data => chrome.storage.local.set({ jpPractice: data }), profile);
  if (liveVideo) await worker.evaluate(() => {
    globalThis.__jpProfileWrites = { practice: 0, position: 0 };
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.jpPractice) return;
      const before = changes.jpPractice.oldValue ?? {};
      const after = changes.jpPractice.newValue ?? {};
      if (JSON.stringify(before.dailySeconds) !== JSON.stringify(after.dailySeconds)) globalThis.__jpProfileWrites.practice++;
      if (JSON.stringify(before.videoPlaybackPositionSec) !== JSON.stringify(after.videoPlaybackPositionSec)) globalThis.__jpProfileWrites.position++;
    });
  });
  const page = await context.newPage();
  page.on('console', msg => { if (msg.type() === 'error' || /JustPractice/.test(msg.text())) result.console.push({type: msg.type(), text: msg.text()}); });
  page.on('pageerror', error => result.errors.push(error.message));
  await page.goto(`https://www.youtube.com/watch?v=${liveVideo || 'pf000000000'}${liveVideo ? '&hl=en' : ''}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!liveVideo) await page.locator('#jp-profile-fixture').waitFor();
  await page.locator('#jp-practice-yt-panel-host [part="add"]').waitFor();
  result.panelObservedUsableMs = await page.evaluate(() => performance.now());
  for (const other of context.pages()) if (other !== page) await other.close();
  await page.bringToFront();
  if (liveVideo) await page.evaluate(async () => {
    const video = document.querySelector('#movie_player video');
    if (!video) throw new Error('No main YouTube player is available.');
    const live = globalThis.__jpProfile.live = { mediaAdvanceSec: 0, loops: 0, adObserved: false };
    let previous = video.currentTime;
    video.addEventListener('timeupdate', () => {
      const next = video.currentTime;
      const delta = next - previous;
      if (delta > 0 && delta < 5) live.mediaAdvanceSec += delta;
      if (delta < -5) live.loops++;
      if (document.querySelector('#movie_player')?.classList.contains('ad-showing')) live.adObserved = true;
      previous = next;
    });
    video.muted = true;
    video.loop = true;
    await Promise.race([video.play(), new Promise((_, reject) => setTimeout(() => reject(new Error('Live playback did not start within 15 seconds.')), 15000))]);
  });
  else await page.evaluate(async () => {
    const grid = document.getElementById('jp-practice-yt-panel-host').shadowRoot.querySelector('[part="cal-grid"]');
    if (grid) new MutationObserver(entries => { globalThis.__jpProfile.calendarReplacements += entries.filter(e => e.type === 'childList' && e.target === grid).length; }).observe(grid, { childList: true });
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
    const ctx = canvas.getContext('2d'); let frame = 0;
    const draw = () => { ctx.fillStyle = '#252b35'; ctx.fillRect(0, 0, 640, 360); ctx.fillStyle = '#f1f3f7'; ctx.font = '24px sans-serif'; ctx.fillText('Synthetic playback · frame '+frame++, 40, 180); };
    draw(); const video = document.querySelector('video'); video.srcObject = canvas.captureStream(5); video.muted = true;
    setInterval(draw, 200); await video.play();
  });
  const videoBox = await page.locator('video').boundingBox();
  if (!videoBox || videoBox.width < 120 || videoBox.height < 120) throw new Error('The playback page must expose a visible main player.');
  const cdp = await context.newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  await context.tracing.start({ screenshots: false, snapshots: true, sources: true });
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.start');
  const started = Date.now(); let cpuProfileSaved = false;
  const sample = async () => {
    const elapsed = (Date.now() - started) / 1000;
    const state = await worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice);
    const sample = { elapsedSeconds: elapsed, heap: await cdp.send('Runtime.getHeapUsage'), dom: await cdp.send('Memory.getDOMCounters'),
      ...await page.evaluate(() => ({ browserTimeMs: performance.now(), mediaTime: document.querySelector('video').currentTime, paused: document.querySelector('video').paused, ended: document.querySelector('video').ended, videoRect: document.querySelector('video').getBoundingClientRect().toJSON(), visibility: document.visibilityState,
        longTaskCount: globalThis.__jpProfile.longTasks.length, longestTaskMs: Math.max(0, ...globalThis.__jpProfile.longTasks.map(e => e.duration)), calendarReplacements: globalThis.__jpProfile.calendarReplacements,
        panelText: document.getElementById('jp-practice-yt-panel-host').shadowRoot.querySelector('[part="add"]').textContent,
        dailyCaption: document.getElementById('jp-practice-yt-panel-host').shadowRoot.querySelector('[part="daily-practice-caption"]').textContent,
        debug: document.getElementById('jp-practice-yt-panel-host').shadowRoot.querySelector('[part="jp-debug-strip"]').textContent,
        hint: document.getElementById('jp-practice-yt-panel-host').shadowRoot.querySelector('[part="hint"]').textContent })),
      settings: { pauseWhenUnfocused: state.settings.pauseWhenUnfocused },
      ...(liveVideo ? { writes: await worker.evaluate(() => globalThis.__jpProfileWrites ?? null), ...await page.evaluate(() => globalThis.__jpProfile.live) } : {}),
      persistedPractice: Object.values(state.dailySeconds).reduce((a, b) => a + b, 0) };
    result.samples.push(sample); await save();
    process.stdout.write(`${label}: ${Math.round(elapsed)}s, media ${sample.mediaTime.toFixed(1)}s, saved ${sample.persistedPractice}s, heap ${(sample.heap.usedSize / 1048576).toFixed(2)} MiB, DOM ${sample.dom.nodes}\n`);
  };
  await sample();
  await (liveVideo ? page.locator('#jp-practice-yt-panel-host') : page).screenshot({ path: path.join(dir, `${label}-watch-start.png`) });
  while (Date.now() - started < seconds * 1000) {
    await new Promise(resolve => setTimeout(resolve, Math.min(30000, seconds * 1000 - (Date.now() - started))));
    if (!cpuProfileSaved) { const { profile } = await cdp.send('Profiler.stop'); await fs.writeFile(path.join(dir, `${label}-watch.cpuprofile`), JSON.stringify(profile)); cpuProfileSaved = true; }
    await sample();
  }
  await cdp.send('HeapProfiler.collectGarbage');
  result.finalPostGcHeap = await cdp.send('Runtime.getHeapUsage');
  result.finalDom = await cdp.send('Memory.getDOMCounters');
  result.longTasks = await page.evaluate(() => globalThis.__jpProfile.longTasks);
  result.steadyLongTasks = result.longTasks.filter(task => task.start >= 60000);
  result.elapsedSeconds = (Date.now() - started) / 1000;
  const last = result.samples.at(-1);
  const observedPlayback = liveVideo ? last.mediaAdvanceSec : result.elapsedSeconds;
  result.trackingWithinWindow = last.persistedPractice >= observedPlayback - 35 && last.persistedPractice <= observedPlayback + 5;
  await (liveVideo ? page.locator('#jp-practice-yt-panel-host') : page).screenshot({ path: path.join(dir, `${label}-watch-end.png`) });
  await context.tracing.stop({ path: path.join(dir, `${label}-watch-trace.zip`) });
  result.complete = true; await save();
  if (!result.trackingWithinWindow || result.errors.length) process.exitCode = 1;
} catch (error) {
  result.fatalError = error.message;
  await save();
  throw error;
} finally { await context.close(); }
