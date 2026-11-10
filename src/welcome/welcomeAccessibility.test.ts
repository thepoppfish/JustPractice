// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyPersisted } from '../lib/storage';

beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = '<div id="app"></div>';
  vi.stubGlobal('chrome', {
    runtime: { sendMessage: vi.fn(async () => ({ ok: true, data: emptyPersisted() })), openOptionsPage: vi.fn() },
    tabs: { create: vi.fn() },
  });
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  await import('./main');
  await vi.waitFor(() => expect(document.querySelector('input[data-locale]')).not.toBeNull());
});

afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });

async function click(selector: string) {
  document.querySelector<HTMLElement>(selector)!.click();
  await vi.waitFor(() => expect(document.getElementById('app')?.getAttribute('aria-busy')).toBeNull());
}

describe('accessible onboarding', () => {
  it('has a native language group and exposes the current step without hidden focusable dots', () => {
    expect(document.querySelector('fieldset legend')?.textContent).toBe('Select your language');
    expect(document.querySelectorAll('input[name="ui-locale"]')).toHaveLength(6);
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(document.querySelector('.welcome-progress [aria-current="step"]')?.textContent).toBe('Language');
    expect(document.querySelector('.welcome-progress button')).toBeNull();
    expect(document.querySelector('.welcome-hello-stage[aria-live]')).toBeNull();
    expect(document.querySelector<HTMLElement>('.jp-action-status')?.hidden).toBe(true);
  });

  it('keeps the selected language focused while applying Hebrew direction', async () => {
    await click('input[data-locale="he"]');
    expect([document.documentElement.lang, document.documentElement.dir]).toEqual(['he', 'rtl']);
    expect((document.activeElement as HTMLInputElement).value).toBe('he');
    await click('#welcome-continue');
    expect(document.activeElement).toBe(document.querySelector('h2'));
    await click('input[value="cefr"]');
    expect(document.querySelector('input[value="cefr"]')?.parentElement?.classList.contains('is-selected')).toBe(true);
  });

  it('updates preset semantics, retains custom minutes and restores heading focus when going back', async () => {
    await click('input[data-locale="en"]');
    await click('#welcome-continue');
    await click('#welcome-continue');
    const chip = document.querySelector<HTMLButtonElement>('[data-goal-minutes]')!;
    chip.click();
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    const input = document.querySelector<HTMLInputElement>('#welcome-goal-minutes')!;
    input.value = '17';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.querySelectorAll('[data-goal-minutes][aria-pressed="true"]')).toHaveLength(0);
    await click('#welcome-continue');
    await click('#welcome-back');
    expect(document.querySelector<HTMLInputElement>('#welcome-goal-minutes')!.value).toBe('17');
    expect(document.activeElement).toBe(document.querySelector('h2'));
  });
});
