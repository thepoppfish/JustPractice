import { test, expect } from './fixtures';

test('saved-video details and completion celebration remain usable', async ({ context, extensionId }, testInfo) => {
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await page.evaluate(async () => {
    await chrome.runtime.sendMessage({ type: 'SET_SETTINGS', payload: { uiLocale: 'en' } });
    await chrome.runtime.sendMessage({ type: 'ADD_OR_UPDATE_LIBRARY', payload: {
      videoId: 'abcdefghijk', title: 'Synthetic celebration fixture', channel: 'Synthetic channel', durationSec: 600,
    } });
  });
  await context.route('https://www.youtube.com/watch?v=abcdefghijk', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><title>Synthetic celebration fixture - YouTube</title></head><body><main><ytd-watch-flexy video-id="abcdefghijk"><h1 class="title">Synthetic celebration fixture</h1><div id="channel-name"><a>Synthetic channel</a></div><video controls width="640" height="360"></video></ytd-watch-flexy></main></body></html>' }));
  await page.goto('https://www.youtube.com/watch?v=abcdefghijk');
  const panel = page.locator('#jp-practice-yt-panel-host');
  await expect(panel.locator('[part="complete-btn"]')).toBeVisible();
  const worker = context.serviceWorkers()[0];
  const originalSave = await worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.library[0].addedAt);
  await panel.locator('[part="add"]').click();
  await expect(panel.locator('[part="difficulty"]')).toBeFocused();
  await expect(panel.locator('[part="difficulty"]')).toBeInViewport();
  expect(await worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.library[0].addedAt)).toBe(originalSave);
  const fx = panel.locator('[part="daily-ring-fx"]');
  // Observe the real output rather than depending on a short animation window
  // staying open while an overloaded CI worker takes the next screenshot.
  await fx.evaluate(element => {
    const svg = element as SVGSVGElement;
    new MutationObserver(() => {
      for (const [key, selector] of Object.entries({ sparks: 'circle.daily-ring-spark', stars: 'g.daily-ring-star', ripples: 'circle.daily-ring-ripple' })) {
        svg.dataset[key] = String(Math.max(Number(svg.dataset[key] || 0), svg.querySelectorAll(selector).length));
      }
    }).observe(svg, { childList: true, subtree: true });
  });
  await panel.locator('[part="complete-btn"]').click();
  for (const key of ['sparks', 'stars', 'ripples']) {
    await expect.poll(async () => Number(await fx.getAttribute(`data-${key}`))).toBeGreaterThan(0);
  }
  await panel.screenshot({ path: testInfo.outputPath('watch-completion-celebration.png') });
  await expect.poll(() => context.serviceWorkers()[0].evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.library[0].completedAt)).not.toBeNull();
  await expect(fx.locator('g.daily-ring-celebration')).toHaveCount(0);
  expect(errors).toEqual([]);
});
