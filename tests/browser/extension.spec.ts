import { test, expect } from './fixtures';

for (const locale of ['en', 'he'] as const) {
  test(`installed extension: setup, library, settings and popup (${locale})`, async ({ context, extensionId }, testInfo) => {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const url = (surface: string) => `chrome-extension://${extensionId}/src/${surface}/index.html`;
    await page.goto(url('welcome'));
    await page.locator(`input[data-locale="${locale}"]`).check();
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'he' ? 'rtl' : 'ltr');
    await page.locator('#welcome-continue').click();
    await page.locator('input[value="cefr"]').check();
    await page.locator('#welcome-continue').click();
    await page.locator('#welcome-goal-minutes').fill('25');
    await page.locator('#welcome-continue').click();
    await page.locator('#welcome-continue').click();
    await expect(page.locator('#welcome-open-dashboard')).toBeVisible();
    const settings = await page.evaluate(async () => {
      const result = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      if (!result.ok) throw new Error(result.error);
      return result.data.settings;
    });
    expect(settings.uiLocale).toBe(locale);
    expect(settings.goals.dailyTargetSec).toBe(1500);
    const added = await page.evaluate(() => chrome.runtime.sendMessage({
      type: 'ADD_OR_UPDATE_LIBRARY',
      payload: { videoId: 'abcdefghijk', title: 'English • עברית • 日本語 practice', channel: 'Smoke fixture', difficulty: 'A2', durationSec: 600 },
    }));
    expect(added.ok).toBe(true);
    await page.goto(url('dashboard'));
    await expect(page.locator('.app-shell')).toBeVisible();
    await page.locator('[data-view="library"]').click();
    await expect(page.locator('.card-title')).toHaveText('English • עברית • 日本語 practice');
    await page.screenshot({ path: testInfo.outputPath(`library-${locale}.png`) });
    await page.locator('[data-view="settings"]').click();
    const focus = page.locator('#pause-unfocused');
    await focus.uncheck();
    await expect(focus).not.toBeChecked();
    await focus.check();
    await expect(focus).toBeChecked();
    await page.reload();
    await expect(page.locator('#pause-unfocused')).toBeChecked();
    await page.screenshot({ path: testInfo.outputPath(`settings-${locale}.png`) });
    await page.setViewportSize({ width: 380, height: 600 });
    await page.goto(url('popup'));
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'he' ? 'rtl' : 'ltr');
    await page.locator('#popup-search').fill('English');
    await expect(page.locator('#popup-search')).toBeFocused();
    await expect(page.getByText('English • עברית • 日本語 practice', { exact: true })).toBeVisible();
    await page.getByRole('tab').last().click();
    await expect(page.locator('#panel-settings')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`popup-${locale}.png`) });
    expect(errors).toEqual([]);
  });
}
