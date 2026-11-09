import { test, expect, setQuotaFailure } from './fixtures';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function setTransportFailure(page: Page, enabled: boolean): Promise<void> {
  await page.evaluate((fail) => {
    const scope = globalThis as typeof globalThis & { __jpRestoreMessage?: () => void };
    scope.__jpRestoreMessage?.();
    if (!fail) return;
    const original = chrome.runtime.sendMessage.bind(chrome.runtime);
    Object.defineProperty(chrome.runtime, 'sendMessage', {
      configurable: true, writable: true,
      value: (message: { type: string }) => message.type === 'SET_SETTINGS'
        ? Promise.reject(new Error('Extension context invalidated')) : original(message),
    });
    scope.__jpRestoreMessage = () => {
      Object.defineProperty(chrome.runtime, 'sendMessage', { configurable: true, writable: true, value: original });
      delete scope.__jpRestoreMessage;
    };
  }, enabled);
}

for (const locale of ['en', 'he'] as const) {
  test(`quota and disconnected-message recovery retain edits (${locale})`, async ({ context, extensionId }, testInfo) => {
    const page = await context.newPage();
    const worker = context.serviceWorkers()[0];
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const url = (view: string) => `chrome-extension://${extensionId}/src/${view}/index.html`;
    await page.goto(url('popup'));
    await page.evaluate((uiLocale) => chrome.runtime.sendMessage({ type: 'SET_SETTINGS', payload: {
      uiLocale, goals: { dailyTargetSec: 1800, weeklyTargetSec: 12600, monthlyTargetSec: 54000 },
    } }), locale);
    await page.goto(url('dashboard'));
    await page.locator('[data-view="goals"]').click();
    await page.locator('#goal-daily-min').fill('45');
    await setQuotaFailure(worker, true);
    await page.locator('#save-goals').click();
    const alert = page.locator('.jp-action-error');
    await expect(alert).toBeVisible();
    await expect(page.locator('#goal-daily-min')).toHaveValue('45');
    expect(await worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.settings.goals.dailyTargetSec)).toBe(1800);
    await alert.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`quota-goals-${locale}.png`) });
    const goalAudit = await new AxeBuilder({ page }).include('[data-view-panel="goals"]').analyze();
    await testInfo.attach(`axe-goals-${locale}`, { body: JSON.stringify(goalAudit), contentType: 'application/json' });
    expect(goalAudit.violations).toEqual([]);
    await setQuotaFailure(worker, false);
    await worker.evaluate(async () => {
      const { jpPractice } = await chrome.storage.local.get('jpPractice');
      jpPractice.settings.displayName = 'External update';
      await chrome.storage.local.set({ jpPractice });
    });
    await expect(page.locator('.dash-welcome')).toContainText('External update');
    await expect(page.locator('#goal-daily-min')).toHaveValue('45');
    await alert.getByRole('button').click();
    await expect(alert).toHaveCount(0);
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.settings.goals.dailyTargetSec)).toBe(2700);
    await expect(page.locator('.jp-action-status')).toBeVisible();

    await page.setViewportSize({ width: 380, height: 600 });
    await page.goto(url('popup'));
    await page.getByRole('tab').last().click();
    await setTransportFailure(page, true);
    await page.locator('#pause-unfocused').uncheck();
    await expect(page.locator('.jp-action-error')).toBeVisible();
    await expect(page.locator('#pause-unfocused')).not.toBeChecked();
    expect(await worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.settings.pauseWhenUnfocused)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`disconnected-popup-${locale}.png`) });
    const popupAudit = await new AxeBuilder({ page }).include('.wrap').analyze();
    await testInfo.attach(`axe-popup-${locale}`, { body: JSON.stringify(popupAudit), contentType: 'application/json' });
    expect(popupAudit.violations).toEqual([]);
    await setTransportFailure(page, false);
    await page.locator('.jp-action-error button').click();
    await expect(page.locator('.jp-action-error')).toHaveCount(0);
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.settings.pauseWhenUnfocused)).toBe(false);
    await expect(page.locator('#pause-unfocused')).not.toBeChecked();
    expect(errors).toEqual([]);
  });
}

test('onboarding stays on its step after rejection and retries the saved choices', async ({ context, extensionId }, testInfo) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/welcome/index.html`);
  await page.locator('input[data-locale="he"]').check();
  await page.locator('#welcome-continue').click();
  await page.locator('input[value="cefr"]').check();
  await page.locator('#welcome-continue').click();
  await page.locator('#welcome-goal-minutes').fill('17');
  await page.locator('#welcome-continue').click();
  await setTransportFailure(page, true);
  await page.locator('#welcome-continue').click();
  await expect(page.locator('.jp-action-error')).toBeVisible();
  await expect(page.locator('#welcome-open-dashboard')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('onboarding-rejected-he.png') });
  const audit = await new AxeBuilder({ page }).include('#app').analyze();
  await testInfo.attach('axe-onboarding-error', { body: JSON.stringify(audit), contentType: 'application/json' });
  expect(audit.violations).toEqual([]);
  await setTransportFailure(page, false);
  await page.locator('.jp-action-error button').click();
  await expect(page.locator('#welcome-open-dashboard')).toBeVisible();
  const settings = await page.evaluate(async () => (await chrome.runtime.sendMessage({ type: 'GET_STATE' })).data.settings);
  expect(settings.uiLocale).toBe('he');
  expect(settings.levelFramework).toBe('cefr');
  expect(settings.goals.dailyTargetSec).toBe(1020);
  expect(await page.evaluate(async () => (await chrome.runtime.sendMessage({ type: 'GET_STATE' })).data.onboardingCompletedAt)).toBeGreaterThan(0);
});

test('watch save, difficulty and completion failures keep their state and can be retried', async ({ context, extensionId }, testInfo) => {
  const setup = await context.newPage();
  const worker = context.serviceWorkers()[0];
  await setup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await setup.evaluate(() => chrome.runtime.sendMessage({ type: 'SET_SETTINGS', payload: { uiLocale: 'he' } }));
  await context.route('https://www.youtube.com/watch?v=abcdefghijk', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="en"><head><title>Mutation fixture - YouTube</title></head><body><main><ytd-watch-flexy video-id="abcdefghijk" style="display:block;width:800px;height:450px"><h1 class="title">Mutation fixture</h1><div id="channel-name"><a href="#">Fixture channel</a></div><video controls></video></ytd-watch-flexy></main></body></html>',
  }));
  const watch = await context.newPage();
  const errors: string[] = [];
  watch.on('pageerror', (error) => errors.push(error.message));
  await watch.goto('https://www.youtube.com/watch?v=abcdefghijk');
  const panel = watch.locator('#jp-practice-yt-panel-host');
  await expect(panel.locator('[part="add"]')).toBeVisible();
  await expect(panel).toHaveAttribute('lang', 'he');
  await setQuotaFailure(worker, true);
  await panel.locator('[part="add"]').click();
  await expect(panel.locator('.jp-action-error')).toBeVisible();
  expect(await worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.library.length)).toBe(0);
  await panel.locator('.jp-action-error').scrollIntoViewIfNeeded();
  await panel.screenshot({ path: testInfo.outputPath('watch-save-quota-he.png') });
  const audit = await new AxeBuilder({ page: watch }).include('#jp-practice-yt-panel-host').analyze();
  await testInfo.attach('axe-watch-error', { body: JSON.stringify(audit), contentType: 'application/json' });
  expect(audit.violations).toEqual([]);
  await setQuotaFailure(worker, false);
  await panel.locator('.jp-action-error button').click();
  await expect(panel.locator('.jp-action-error')).toHaveCount(0);
  await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.library.length)).toBe(1);

  await setQuotaFailure(worker, true);
  await panel.locator('[part="difficulty"]').selectOption('N3');
  await expect(panel.locator('.jp-action-error')).toBeVisible();
  await expect(panel.locator('[part="difficulty"]')).toHaveValue('N3');
  expect(await worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.library[0].difficulty)).toBeNull();
  await setQuotaFailure(worker, false);
  await panel.locator('.jp-action-error button').click();
  await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.library[0].difficulty)).toBe('N3');

  await setQuotaFailure(worker, true);
  await panel.locator('[part="complete-btn"]').click();
  await expect(panel.locator('.jp-action-error')).toBeVisible();
  expect(await worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.library[0].completedAt)).toBeNull();
  await setQuotaFailure(worker, false);
  await panel.locator('.jp-action-error button').click();
  await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.library[0].completedAt)).toBeGreaterThan(0);
  await setQuotaFailure(worker, true);
  await panel.locator('[part="collapse"]').click();
  await expect(panel.locator('.jp-action-error')).toBeVisible();
  await expect(panel.locator('.wrap')).toHaveClass(/collapsed/);
  expect(await worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.settings.watchPanelCollapsed)).not.toBe(true);
  await setQuotaFailure(worker, false);
  await panel.locator('.jp-action-error button').click();
  await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.settings.watchPanelCollapsed)).toBe(true);
  await panel.locator('[part="collapse"]').click();
  await expect(panel.locator('.wrap')).not.toHaveClass(/collapsed/);
  expect(errors).toEqual([]);
});

test('export reports failure and retry requests a real JSON download', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/dashboard/index.html`);
  await page.locator('[data-view="settings"]').click();
  await page.evaluate(() => {
    const original = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      HTMLAnchorElement.prototype.click = original;
      throw new Error('Download rejected');
    };
  });
  await page.locator('#export-extension-data').click();
  await expect(page.locator('.jp-action-error')).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.locator('.jp-action-error button').click();
  expect((await downloaded).suggestedFilename()).toMatch(/^justpractice-export-.*\.json$/);
  await expect(page.locator('.jp-action-error')).toHaveCount(0);
});

test('pending writes disable conflicts and ignore a second real pointer click', async ({ context, extensionId }) => {
  const page = await context.newPage();
  const worker = context.serviceWorkers()[0];
  await page.goto(`chrome-extension://${extensionId}/src/dashboard/index.html`);
  await page.locator('[data-view="goals"]').click();
  await page.locator('#goal-daily-min').fill('40');
  await worker.evaluate(() => {
    const scope = globalThis as typeof globalThis & { __jpReleaseWrite?: () => void; __jpWriteCount?: number };
    const original = chrome.storage.local.set.bind(chrome.storage.local);
    scope.__jpWriteCount = 0;
    Object.defineProperty(chrome.storage.local, 'set', {
      configurable: true, writable: true,
      value: async (items: Record<string, unknown>) => {
        scope.__jpWriteCount!++;
        await new Promise<void>((resolve) => { scope.__jpReleaseWrite = resolve; });
        await original(items);
      },
    });
  });
  const button = page.locator('#save-goals');
  const bounds = (await button.boundingBox())!;
  await button.click();
  await expect(button).toBeDisabled();
  await expect(page.locator('#goal-daily-min')).toBeDisabled();
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  expect(await worker.evaluate(() => (globalThis as typeof globalThis & { __jpWriteCount: number }).__jpWriteCount)).toBe(1);
  await worker.evaluate(() => (globalThis as typeof globalThis & { __jpReleaseWrite: () => void }).__jpReleaseWrite());
  await expect(button).toBeEnabled();
  await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.settings.goals.dailyTargetSec)).toBe(2400);
});

test('successful settings saves release their drafts while unrelated and failed edits survive', async ({ context, extensionId }) => {
  const page = await context.newPage();
  const worker = context.serviceWorkers()[0];
  await page.goto(`chrome-extension://${extensionId}/src/dashboard/index.html`);
  await page.locator('[data-view="goals"]').click();
  await page.locator('#goal-daily-min').fill('47');
  await page.locator('[data-view="settings"]').click();
  const message = page.locator('#custom-daily-message-input');
  await message.fill('First message');
  await message.press('Enter');
  await expect(message).toHaveValue('');
  await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.settings.customDailyMessages)).toEqual(['First message']);
  await setQuotaFailure(worker, true);
  await message.fill('Keep this edit');
  await page.locator('#custom-daily-message-add').click();
  await expect(page.locator('.jp-action-error')).toBeVisible();
  await expect(message).toHaveValue('Keep this edit');
  await setQuotaFailure(worker, false);
  await worker.evaluate(async () => {
    const { jpPractice } = await chrome.storage.local.get('jpPractice');
    jpPractice.settings.displayName = 'Another window';
    await chrome.storage.local.set({ jpPractice });
  });
  await expect(page.locator('.dash-welcome')).toContainText('Another window');
  await expect(message).toHaveValue('Keep this edit');
  await message.fill('Latest message');
  await page.locator('.jp-action-error button').click();
  await expect(message).toHaveValue('');
  await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.settings.customDailyMessages)).toEqual(['First message', 'Latest message']);
  await page.locator('[data-view="goals"]').click();
  await expect(page.locator('#goal-daily-min')).toHaveValue('47');
  expect(await worker.evaluate(async () => (await chrome.storage.local.get('jpPractice')).jpPractice.settings.goals.dailyTargetSec)).toBeNull();
});
