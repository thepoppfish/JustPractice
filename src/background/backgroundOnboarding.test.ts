import { describe, expect, it } from 'vitest';
import { shouldOpenWelcomeOnInstall } from './backgroundOnboarding';

describe('shouldOpenWelcomeOnInstall', () => {
  it('opens welcome only on fresh install', () => {
    expect(shouldOpenWelcomeOnInstall('install')).toBe(true);
    expect(shouldOpenWelcomeOnInstall('update')).toBe(false);
    expect(shouldOpenWelcomeOnInstall('chrome_update')).toBe(false);
    expect(shouldOpenWelcomeOnInstall('shared_module_update')).toBe(false);
  });
});
