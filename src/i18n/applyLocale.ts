import type { ResolvedLocale } from './localeMeta';

/** Apply to an extension document, or only its host when embedded in YouTube. */
export function applyUiLocale(locale: ResolvedLocale, root: HTMLElement = document.documentElement): void {
  root.lang = locale;
  root.dir = locale === 'he' ? 'rtl' : 'ltr';
}
