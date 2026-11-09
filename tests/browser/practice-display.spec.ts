import { test, expect } from './fixtures';

test('watch practice display counts pending playback once across polls and persistence', async ({ context, extensionId }, testInfo) => {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await page.evaluate(async () => {
    await chrome.runtime.sendMessage({ type: 'SET_SETTINGS', payload: { uiLocale: 'en', pauseWhenUnfocused: false } });
    await chrome.runtime.sendMessage({ type: 'ADD_OR_UPDATE_LIBRARY', payload: {
      videoId: 'abcdefghijk', title: 'Sustained display regression', channel: 'Synthetic channel', durationSec: 600,
    } });
  });
  await context.route('https://www.youtube.com/watch?v=abcdefghijk', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><title>Sustained display regression - YouTube</title></head><body><main><ytd-watch-flexy video-id="abcdefghijk"><h1 class="title">Sustained display regression</h1><div id="movie_player"><video muted autoplay width="640" height="360"></video></div></ytd-watch-flexy></main></body></html>' }));
  await page.goto('https://www.youtube.com/watch?v=abcdefghijk');
  const panel = page.locator('#jp-practice-yt-panel-host');
  await expect(panel.locator('[part="add"]')).toHaveText('Already saved — details');
  for (const other of context.pages()) if (other !== page) await other.close();
  await page.bringToFront();
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 360;
    const paint = canvas.getContext('2d')!;
    const draw = () => { paint.fillStyle = '#252c35'; paint.fillRect(0, 0, 640, 360); };
    draw();
    const video = document.querySelector('video')!;
    video.srcObject = canvas.captureStream(5);
    setInterval(draw, 200);
    await video.play();
  });
  // Cross two 15-second storage polls and the normal 30-second practice flush.
  await expect.poll(() => page.locator('video').evaluate(video => video.currentTime), { timeout: 45_000, intervals: [1000] }).toBeGreaterThan(36);
  const mediaSeconds = await page.locator('video').evaluate(video => video.currentTime);
  const caption = await panel.locator('[part="daily-practice-caption"]').innerText();
  const displayedSeconds = Number(caption.match(/(\d+) min/)?.[1] ?? 0) * 60 + Number(caption.match(/(\d+) s(?:\s|$)/)?.[1] ?? 0);
  expect(displayedSeconds).toBeGreaterThanOrEqual(Math.floor(mediaSeconds) - 4);
  expect(displayedSeconds).toBeLessThanOrEqual(Math.ceil(mediaSeconds) + 2);
  const saved = await context.serviceWorkers()[0].evaluate(async () => {
    const data = (await chrome.storage.local.get('jpPractice')).jpPractice;
    return Object.values(data.dailySeconds as Record<string, number>).reduce((a, b) => a + b, 0);
  });
  expect(saved).toBeGreaterThanOrEqual(25);
  expect(saved).toBeLessThanOrEqual(mediaSeconds + 2);
  await panel.screenshot({ path: testInfo.outputPath('watch-practice-display.png') });
  expect(errors).toEqual([]);
});
