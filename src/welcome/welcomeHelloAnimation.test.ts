import { describe, expect, it } from 'vitest';
import { buildHelloSlides } from './welcomeHelloAnimation';
import { SUPPORTED_RESOLVED_LOCALES } from '../i18n';

describe('buildHelloSlides', () => {
  it('includes every supported locale hello', () => {
    const slides = buildHelloSlides();
    expect(slides).toHaveLength(SUPPORTED_RESOLVED_LOCALES.length);
    const hellos = new Set(slides.map((s) => s.hello));
    expect(hellos.size).toBe(slides.length);
    expect(slides.map((s) => s.locale)).toEqual([...SUPPORTED_RESOLVED_LOCALES]);
  });

  it('uses RTL for Hebrew', () => {
    const he = buildHelloSlides().find((s) => s.locale === 'he');
    expect(he?.dir).toBe('rtl');
    expect(he?.hello).toBe('שלום');
  });
});
