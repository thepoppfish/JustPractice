import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

for (const locale of ['en', 'he'] as const) {
  test(`readable statistics, accurate counts and grouped settings (${locale})`, async ({ context, extensionId }, testInfo) => {
    const page = await context.newPage();
    const worker = context.serviceWorkers()[0];
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await page.evaluate(async uiLocale => {
      await chrome.runtime.sendMessage({ type: 'SET_SETTINGS', payload: { uiLocale, goals: { dailyTargetSec: 1800, weeklyTargetSec: 12600, monthlyTargetSec: 54000 } } });
      for (const videoId of ['abcdefghijk', 'lmnopqrstuv']) await chrome.runtime.sendMessage({ type: 'ADD_OR_UPDATE_LIBRARY', payload: {
        videoId, title: 'Practice fixture '+videoId, channel: 'Synthetic channel', durationSec: 600, difficulty: 'N3',
      } });
    }, locale);
    await page.goto('about:blank');
    await worker.evaluate(async () => {
      const { jpPractice } = await chrome.storage.local.get('jpPractice');
      const now = new Date();
      const day = [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-');
      jpPractice.dailySeconds = { [day]: 1200 };
      jpPractice.videoSeconds = { abcdefghijk: 600, lmnopqrstuv: 600 };
      await chrome.storage.local.set({ jpPractice });
    });
    await page.goto(`chrome-extension://${extensionId}/src/dashboard/index.html`);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.locator('[data-view="stats"]').click();
    await expect(page.locator('.stats-primary-value')).toHaveText(locale === 'en' ? '20 min' : '20 דק׳');
    await expect(page.locator('.stats-today progress')).toHaveAttribute('value', '1200');
    const cta = page.locator('.stats-today .jp-primary');
    const ctaBox = await cta.boundingBox();
    expect(ctaBox).not.toBeNull();
    expect(ctaBox!.y + ctaBox!.height).toBeLessThanOrEqual(768);
    await page.screenshot({ path: testInfo.outputPath(`stats-${locale}-1024.png`) });
    await page.setViewportSize({ width: 1440, height: 900 });
    const statsAudit = await new AxeBuilder({ page }).include('[data-view-panel="stats"]').analyze();
    await testInfo.attach(`axe-stats-${locale}`, { body: JSON.stringify(statsAudit), contentType: 'application/json' });
    expect(statsAudit.violations).toEqual([]);
    await cta.click();
    await expect(page.locator('[data-view-panel="library"]')).toHaveClass(/view--active/);
    const first = page.locator('.video-card').first();
    await first.locator('summary').click();
    await first.locator('[data-library-complete]').click();
    await expect(page.locator('[data-total-saved] strong')).toHaveText('2');
    await page.locator('[data-view="stats"]').click();
    await expect(page.locator('.stats-library-counts')).toContainText('2');
    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'SET_SETTINGS', payload: { goals: { dailyTargetSec: 600, weeklyTargetSec: 4200, monthlyTargetSec: 18000 } } }));
    await expect(page.locator('.stats-today')).toHaveClass(/is-met/);
    await expect(page.locator('.stats-today progress')).toHaveAttribute('value', '600');
    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'SET_SETTINGS', payload: { goals: { dailyTargetSec: null, weeklyTargetSec: null, monthlyTargetSec: null } } }));
    await expect(page.locator('.stats-today progress')).toHaveCount(0);
    await expect(page.locator('.stats-today .jp-primary')).toHaveAttribute('data-stats-view', 'goals');
    await expect(page.locator('.stats-primary-value')).toContainText('20');
    await page.locator('[data-view="settings"]').click();
    await page.locator('[data-settings-section="settings-counting"]').click();
    await page.locator('#pause-unfocused').uncheck();
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.settings.pauseWhenUnfocused)).toBe(false);
    await page.locator('[data-settings-section="settings-language"]').click();
    await page.locator('#setting-level-framework').selectOption('custom');
    await page.locator('#custom-levels-lines').fill('Starter\nAdvanced');
    await page.locator('#save-custom-levels').click();
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.settings.customLevels)).toEqual(['Starter','Advanced']);
    await page.locator('[data-settings-section="settings-personalization"]').click();
    await expect(page.locator('#settings-personalization')).toHaveAttribute('open', '');
    await page.locator('#setting-display-name').fill('Practice profile');
    await page.locator('#setting-display-name').press('Tab');
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.settings.displayName)).toBe('Practice profile');
    await expect(page.locator('#settings-personalization')).toHaveAttribute('open', '');
    const settingsAudit = await new AxeBuilder({ page }).include('[data-view-panel="settings"]').analyze();
    await testInfo.attach(`axe-settings-${locale}`, { body: JSON.stringify(settingsAudit), contentType: 'application/json' });
    expect(settingsAudit.violations).toEqual([]);
    await page.locator('[data-settings-section="settings-data"]').click();
    await expect(page.locator('.data-actions #clear-extension-data')).toHaveCount(0);
    await expect(page.locator('.settings-danger #clear-extension-data')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`settings-data-${locale}.png`) });
    page.once('dialog', dialog => dialog.dismiss());
    await page.locator('#clear-extension-data').click();
    expect(await worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.library.length)).toBe(2);
    await page.evaluate(async () => {
      for (const videoId of ['abcdefghijk', 'lmnopqrstuv']) await chrome.runtime.sendMessage({
        type: 'SET_LIBRARY_COMPLETION', payload: { videoId, complete: true },
      });
    });
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await page.locator('#tab-stats').click();
    // The popup opens the dashboard for completed items; its label must name
    // that destination rather than promising a completed view it cannot route to.
    await expect(page.locator('#popup-stats-next')).toHaveText(await page.locator('#open-dashboard').innerText());
    expect(errors).toEqual([]);
  });
}

test('primary controls share tokens across dashboard, popup, onboarding and watch shadow DOM', async ({ context, extensionId }, testInfo) => {
  const page = await context.newPage();
  const remoteStyles: string[] = [];
  page.on('request', request => {
    if (request.url().startsWith('https://www.youtube.com/') && request.resourceType() === 'stylesheet') remoteStyles.push(request.url());
  });
  const url = (view: string) => `chrome-extension://${extensionId}/src/${view}/index.html`;
  await page.goto(url('popup'));
  await page.evaluate(async () => {
    await chrome.runtime.sendMessage({ type: 'SET_SETTINGS', payload: { uiLocale: 'en' } });
    await chrome.runtime.sendMessage({ type: 'ADD_OR_UPDATE_LIBRARY', payload: { videoId: 'lmnopqrstuv', title: 'Shared styles', channel: 'Synthetic', durationSec: 600 } });
  });
  await page.reload();
  const colors: unknown[] = [];
  const style = (el: Element) => { const css = getComputedStyle(el); return { background: css.backgroundColor, color: css.color, radius: css.borderRadius, minHeight: css.minHeight, boxSizing: css.boxSizing }; };
  colors.push(await page.locator('.library-primary').evaluate(style));
  await page.goto(url('dashboard'));
  await page.locator('[data-view="stats"]').click();
  colors.push(await page.locator('.stats-today .jp-primary').evaluate(style));
  await page.goto(url('welcome'));
  colors.push(await page.locator('#welcome-continue').evaluate(style));
  await context.route('https://www.youtube.com/watch?v=abcdefghijk', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><title>Synthetic fixture - YouTube</title></head><body><main><ytd-watch-flexy video-id="abcdefghijk"><h1 class="title">Synthetic fixture</h1><div id="channel-name"><a>Synthetic channel</a></div><video controls></video></ytd-watch-flexy></main></body></html>' }));
  await page.goto('https://www.youtube.com/watch?v=abcdefghijk');
  const panel = page.locator('#jp-practice-yt-panel-host');
  await expect(panel.locator('[part="add"]')).toBeVisible();
  colors.push(await panel.locator('[part="add"]').evaluate(style));
  expect(colors).toEqual(Array(4).fill({ background: 'rgb(255, 139, 86)', color: 'rgb(32, 17, 9)', radius: '8px', minHeight: '44px', boxSizing: 'border-box' }));
  await expect(panel.locator('[part="daily-practice-caption"]')).toContainText('Today: 0 min');
  const audit = await new AxeBuilder({ page }).include('#jp-practice-yt-panel-host').analyze();
  await testInfo.attach('axe-shared-watch', { body: JSON.stringify(audit), contentType: 'application/json' });
  expect(audit.violations).toEqual([]);
  expect(remoteStyles).toEqual([]);
});
