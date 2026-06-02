import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isDashView, persistDashView, readPersistedDashView } from './dashViewPersistence';

describe('dashViewPersistence', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      clear: () => store.clear(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('isDashView accepts known tabs only', () => {
    expect(isDashView('settings')).toBe(true);
    expect(isDashView('library')).toBe(true);
    expect(isDashView('nope')).toBe(false);
  });

  it('round-trips active view via sessionStorage', () => {
    persistDashView('goals');
    expect(readPersistedDashView()).toBe('goals');
  });

  it('defaults to library when storage is empty or invalid', () => {
    expect(readPersistedDashView()).toBe('library');
    sessionStorage.setItem('jp-dash-active-view', 'bad');
    expect(readPersistedDashView()).toBe('library');
  });
});
