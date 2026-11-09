// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { applyUiLocale } from './applyLocale';

afterEach(() => {
  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
});

describe('UI language and direction', () => {
  it('switches the document to Hebrew and back to an LTR locale', () => {
    applyUiLocale('he');
    expect(document.documentElement.lang).toBe('he');
    expect(document.documentElement.dir).toBe('rtl');
    applyUiLocale('ja');
    expect(document.documentElement.lang).toBe('ja');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('isolates the panel locale from the surrounding YouTube document', () => {
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
    const host = document.createElement('div');
    applyUiLocale('he', host);
    expect([host.lang, host.dir]).toEqual(['he', 'rtl']);
    expect([document.documentElement.lang, document.documentElement.dir]).toEqual(['en', 'ltr']);
  });
});
