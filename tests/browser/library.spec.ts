import { test, expect, setQuotaFailure } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

for (const locale of ['en', 'he'] as const) {
  test(`library hierarchy and cross-view undo preserve saved metadata (${locale})`, async ({ context, extensionId }, testInfo) => {
    const page = await context.newPage();
    const worker = context.serviceWorkers()[0];
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const url = (view: string) => `chrome-extension://${extensionId}/src/${view}/index.html`;
    await page.goto(url('popup'));
    await page.evaluate(async (uiLocale) => {
      await chrome.runtime.sendMessage({ type: 'SET_SETTINGS', payload: { uiLocale } });
      await chrome.runtime.sendMessage({ type: 'ADD_OR_UPDATE_LIBRARY', payload: {
        videoId: 'abcdefghijk', title: 'A long English title • כותרת ארוכה בעברית עם מילים רבות • 日本語の長い練習動画タイトルと詳しい説明',
        channel: 'English / עברית / 日本語', durationSec: 600, difficulty: 'N3',
      } });
    }, locale);
    await page.goto('about:blank');
    await worker.evaluate(async () => {
      const { jpPractice } = await chrome.storage.local.get('jpPractice');
      jpPractice.library[0].addedAt = 1600000000000;
      jpPractice.videoSeconds.abcdefghijk = 1800;
      jpPractice.videoPlaybackPositionSec.abcdefghijk = 123;
      await chrome.storage.local.set({ jpPractice });
    });
    await page.goto(url('dashboard'));
    await page.locator('[data-view="library"]').click();
    const card = page.locator('.video-card');
    await expect(card.locator('.library-primary')).toHaveAttribute('href', /&t=123s$/);
    await expect(card.locator('progress')).toHaveAttribute('value', '123');
    expect(await card.locator('.card-title').evaluate((el) => el.closest('.card-media') === null)).toBe(true);
    await expect(card.locator('[data-remove]')).toBeHidden();
    const summary = card.locator('summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(card.locator('[data-remove]')).toBeVisible();
    await card.locator('[data-library-level]').focus();
    await card.locator('[data-library-level]').selectOption('N2');
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.library[0].difficulty)).toBe('N2');
    await expect(card.locator('[data-library-level]')).toBeFocused();
    await expect(card.locator('details')).toHaveAttribute('open', '');
    await page.screenshot({ path: testInfo.outputPath(`library-actions-${locale}.png`) });
    const audit = await new AxeBuilder({ page }).include('[data-view-panel="library"]').analyze();
    await testInfo.attach(`axe-library-${locale}`, { body: JSON.stringify(audit), contentType: 'application/json' });
    expect(audit.violations).toEqual([]);
    const original = await worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice);
    await card.locator('[data-remove]').click();
    await expect(card).toHaveCount(0);
    await expect(page.locator('[data-undo-removal]')).toBeFocused();
    // Closing and reopening a popup must not destroy the shared recovery offer.
    let popup = await context.newPage();
    await popup.setViewportSize({ width: 380, height: 650 });
    await popup.goto(url('popup'));
    await expect(popup.locator('[data-undo-removal]')).toBeVisible();
    await popup.evaluate(async () => {
      const tab = await chrome.tabs.getCurrent();
      await chrome.tabs.setZoom(tab!.id!, 2);
    });
    await expect(popup.locator('.jp-library-undo-title')).toHaveAttribute('tabindex', '0');
    const undoAudit = await new AxeBuilder({ page: popup }).analyze();
    await testInfo.attach(`axe-undo-zoom-${locale}`, { body: JSON.stringify(undoAudit), contentType: 'application/json' });
    expect(undoAudit.violations).toEqual([]);
    await popup.evaluate(async () => {
      const tab = await chrome.tabs.getCurrent();
      await chrome.tabs.setZoom(tab!.id!, 1);
    });
    await popup.close();
    popup = await context.newPage();
    await popup.setViewportSize({ width: 380, height: 650 });
    await popup.goto(url('popup'));
    await expect(popup.locator('[data-undo-removal]')).toBeVisible();
    await popup.locator('[data-undo-removal]').click();
    await expect(popup.locator('.item')).toHaveCount(1);
    const restored = await worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice);
    expect(restored.library[0]).toEqual({ ...original.library[0], practiceToken: expect.any(String) });
    expect(restored.library[0].practiceToken).not.toBe(original.library[0].practiceToken);
    expect(restored.playerProgress).toEqual(original.playerProgress);
    expect(restored.videoSeconds).toEqual(original.videoSeconds);
    expect(restored.videoPlaybackPositionSec).toEqual(original.videoPlaybackPositionSec);
    await expect(page.locator('.video-card')).toHaveCount(1);
    await popup.locator('[data-dismiss-undo]').click();
    await expect(popup.locator('#popup-search')).toBeFocused();
    const popupSummary = popup.locator('summary');
    await popupSummary.focus();
    await popup.keyboard.press('Enter');
    await popup.locator('[data-remove]').click();
    await expect(popup.locator('[data-undo-removal]')).toBeFocused();
    await page.locator('[data-undo-removal]').click();
    await expect(popup.locator('.item')).toHaveCount(1);
    await page.locator('[data-dismiss-undo]').click();
    await page.locator('.video-card summary').click();
    await page.locator('[data-library-complete]').click();
    await expect(page.locator('.video-card:not(.video-card--completed)')).toHaveCount(0);
    await page.locator('[data-view="completed"]').click();
    const completed = page.locator('.video-card--completed');
    const completedItem = await worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.library[0]);
    await completed.locator('summary').click();
    await completed.locator('[data-remove]').click();
    await page.locator('[data-undo-removal]').click();
    await expect(completed).toHaveCount(1);
    const restoredComplete = await worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.library[0]);
    expect(restoredComplete).toEqual({ ...completedItem, practiceToken: expect.any(String) });
    expect(errors).toEqual([]);
  });
}

test('failed undo retains its offer and succeeds after a real storage retry', async ({ context, extensionId }, testInfo) => {
  const page = await context.newPage();
  const worker = context.serviceWorkers()[0];
  await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'ADD_OR_UPDATE_LIBRARY', payload: {
    videoId: 'abcdefghijk', title: 'Recovery fixture', channel: 'Synthetic', durationSec: 600,
  } }));
  await page.reload();
  await page.locator('summary').click();
  await page.locator('[data-remove]').click();
  await setQuotaFailure(worker, true);
  await page.locator('[data-undo-removal]').click();
  await expect(page.locator('.jp-library-undo-error')).toBeVisible();
  expect(await worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.library)).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('undo-quota-retry.png') });
  const audit = await new AxeBuilder({ page }).analyze();
  await testInfo.attach('axe-undo-error', { body: JSON.stringify(audit), contentType: 'application/json' });
  expect(audit.violations).toEqual([]);
  await setQuotaFailure(worker, false);
  await page.locator('[data-undo-removal]').click();
  await expect(page.locator('.item')).toHaveCount(1);
  await expect(page.locator('.jp-library-undo-error')).toBeHidden();
});

test('an outdated undo cannot overwrite a re-saved video and explains the conflict', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'ADD_OR_UPDATE_LIBRARY', payload: {
    videoId: 'abcdefghijk', title: 'Original title', channel: 'Synthetic', durationSec: 600,
  } }));
  await page.reload();
  await page.locator('summary').click();
  await page.locator('[data-remove]').click();
  await page.evaluate(async () => {
    const stale = await chrome.runtime.sendMessage({ type: 'GET_LIBRARY_UNDO' });
    const original = chrome.runtime.sendMessage.bind(chrome.runtime);
    Object.defineProperty(chrome.runtime, 'sendMessage', { configurable: true, value: (message: { type: string }) =>
      message.type === 'GET_LIBRARY_UNDO' ? Promise.resolve(stale) : original(message) });
    await chrome.runtime.sendMessage({ type: 'ADD_OR_UPDATE_LIBRARY', payload: {
      videoId: 'abcdefghijk', title: 'Newer manual save', channel: 'Synthetic', durationSec: 600,
    } });
  });
  await page.locator('[data-undo-removal]').click();
  await expect(page.locator('.jp-library-undo-error')).toContainText('no longer available');
  await expect(page.locator('[data-undo-removal]')).toBeHidden();
  await expect(page.locator('[data-dismiss-undo]')).toBeFocused();
  expect(await page.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.library[0].title)).toBe('Newer manual save');
});
