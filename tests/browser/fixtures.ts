import { test as base, expect, type BrowserContext, type Worker } from '@playwright/test';
import path from 'node:path';

export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  context: async ({ playwright }, use) => {
    const extension = path.resolve('dist');
    const context = await playwright.chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: process.env.PW_HEADED !== '1',
      viewport: { width: 1280, height: 800 },
      reducedMotion: 'reduce',
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    });
    try {
      // These are installation/UI tests with synthetic video IDs. Do not make
      // their timing depend on YouTube's thumbnail CDN or a live video account.
      await context.route('https://i.ytimg.com/**', (route) => route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#252c35"/><text x="320" y="180" text-anchor="middle" fill="#b7bdc8" font-size="24">Synthetic preview</text></svg>',
      }));
      await use(context);
    } finally {
      await context.close();
    }
  },
  extensionId: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await use(new URL(worker.url()).host);
  },
});


export { expect };

export async function setQuotaFailure(worker: Worker, enabled: boolean): Promise<void> {
  await worker.evaluate((fail) => {
    const scope = globalThis as typeof globalThis & { __jpRestoreStorage?: () => void };
    scope.__jpRestoreStorage?.();
    if (!fail) return;
    const original = chrome.storage.local.set.bind(chrome.storage.local);
    Object.defineProperty(chrome.storage.local, 'set', {
      configurable: true, writable: true,
      value: async () => { throw new Error('QUOTA_BYTES quota exceeded'); },
    });
    scope.__jpRestoreStorage = () => {
      Object.defineProperty(chrome.storage.local, 'set', { configurable: true, writable: true, value: original });
      delete scope.__jpRestoreStorage;
    };
  }, enabled);
}
